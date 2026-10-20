const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const prisma = require('../config/database');

const SALT_ROUNDS = 12;

/**
 * Generate access + refresh token pair
 */
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, jti: uuidv4() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '60m' }
  );
  const refreshToken = jwt.sign(
    { userId, jti: uuidv4() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
};

/**
 * Store refresh token in DB
 */
const storeRefreshToken = async (userId, token) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.upsert({
    where: { token },
    update: { expiresAt },
    create: { token, userId, expiresAt },
  });
};

/**
 * Register a new user
 */
const register = async ({ email, username, password, firstName = '', lastName = '', phone = '' }) => {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const normalizedUsername = (username || '').trim();

  // Check for existing user
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] },
  });
  if (existingUser) {
    if (existingUser.email.toLowerCase() === normalizedEmail) {
      throw Object.assign(new Error('An account with this email already exists.'), { statusCode: 409, code: 'EMAIL_EXISTS' });
    }
    throw Object.assign(new Error('That username is already taken.'), { statusCode: 409, code: 'USERNAME_EXISTS' });
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      username: normalizedUsername,
      password: hashedPassword,
      firstName: (firstName || '').trim(),
      lastName: (lastName || '').trim(),
      phone: phone || null,
    },
  });

  // Create Profile and FinancialProfile
  await prisma.profile.create({
    data: { userId: user.id },
  }).catch(() => {});

  await prisma.financialProfile.create({
    data: {
      userId: user.id,
      monthlySalary: 0,
      estimatedMonthlyExpenses: 0,
      currentSavings: 0,
      totalDebt: 0,
    },
  }).catch(() => {});

  // Create default financial account
  await prisma.financialAccount.create({
    data: {
      userId: user.id,
      name: 'Primary Account',
      accountType: 'BANK',
      balance: 0,
      currency: 'INR',
    },
  });

  const { accessToken, refreshToken } = generateTokens(user.id);
  await storeRefreshToken(user.id, refreshToken);

  return { user: sanitizeUser(user), accessToken, refreshToken };
};

/**
 * Login with email/username + password
 */
const login = async ({ emailOrUsername, password }) => {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailOrUsername.toLowerCase().trim() },
        { username: emailOrUsername.trim() },
      ],
    },
  });

  if (!user || !user.password) {
    throw Object.assign(new Error('Invalid email/username or password.'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw Object.assign(new Error('Invalid email/username or password.'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  if (!user.isActive) {
    throw Object.assign(new Error('Your account has been deactivated.'), { statusCode: 403, code: 'ACCOUNT_DEACTIVATED' });
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const { accessToken, refreshToken } = generateTokens(user.id);
  await storeRefreshToken(user.id, refreshToken);

  return { user: sanitizeUser(user), accessToken, refreshToken };
};

/**
 * Refresh access token using refresh token
 */
const refreshAccessToken = async (refreshToken) => {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token.'), { statusCode: 401, code: 'INVALID_REFRESH_TOKEN' });
  }

  // Check it exists in DB (revocation check)
  const storedToken = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw Object.assign(new Error('Refresh token has been revoked or expired.'), { statusCode: 401, code: 'TOKEN_REVOKED' });
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found.'), { statusCode: 401, code: 'USER_NOT_FOUND' });
  }

  // Rotate: delete old, create new
  await prisma.refreshToken.delete({ where: { token: refreshToken } });
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);
  await storeRefreshToken(user.id, newRefreshToken);

  return { accessToken, refreshToken: newRefreshToken };
};

/**
 * Logout — revoke refresh token
 */
const logout = async (refreshToken) => {
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  return true;
};

/**
 * Generate cryptographically signed OAuth state JWT for CSRF protection
 */
const generateOAuthState = (customData = {}) => {
  const data = typeof customData === 'string' ? { returnTo: customData } : (customData || {});
  return jwt.sign(
    {
      purpose: 'google_oauth_state',
      nonce: uuidv4(),
      createdAt: Date.now(),
      ...data,
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

/**
 * Verify and unpack OAuth state JWT
 */
const verifyOAuthState = (stateToken) => {
  if (!stateToken) {
    throw Object.assign(new Error('Missing OAuth state parameter.'), { statusCode: 400, code: 'INVALID_OAUTH_STATE' });
  }
  try {
    const decoded = jwt.verify(stateToken, process.env.JWT_SECRET);
    if (decoded.purpose !== 'google_oauth_state') {
      throw new Error('State purpose mismatch');
    }
    return decoded;
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired OAuth state parameter.'), { statusCode: 400, code: 'INVALID_OAUTH_STATE' });
  }
};

/**
 * Google OAuth — verify Google identity and create/find user safely
 */
const googleAuth = async (idToken, googleAccessToken = null) => {
  let googleData = null;

  // 1. Verify ID token via Google tokeninfo
  try {
    const googleRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`, { timeout: 8000 });
    googleData = googleRes.data;
  } catch (tokenErr) {
    // If ID token verification failed but access token is available, try userinfo endpoint
    if (googleAccessToken) {
      try {
        const userinfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${googleAccessToken}` },
          timeout: 8000,
        });
        googleData = userinfoRes.data;
      } catch (uiErr) {
        throw Object.assign(new Error('Unable to verify Google credentials with Google Identity Services.'), { statusCode: 401, code: 'GOOGLE_VERIFICATION_FAILED' });
      }
    } else {
      throw Object.assign(new Error('Invalid or expired Google ID token.'), { statusCode: 401, code: 'GOOGLE_INVALID_TOKEN' });
    }
  }

  const email = (googleData.email || '').toLowerCase().trim();
  const firstName = (googleData.given_name || '').trim();
  const lastName = (googleData.family_name || '').trim();
  const googleId = String(googleData.sub || '');
  const avatarUrl = googleData.picture || null;
  const isEmailVerified = googleData.email_verified === true || googleData.email_verified === 'true';

  if (!email) {
    throw Object.assign(new Error('Google account does not provide a valid email address.'), { statusCode: 400, code: 'GOOGLE_NO_EMAIL' });
  }

  if (!isEmailVerified) {
    throw Object.assign(new Error('Google email address is unverified. Please verify your email with Google before signing in.'), { statusCode: 403, code: 'GOOGLE_EMAIL_UNVERIFIED' });
  }

  // Validate audience if client ID is configured
  const configuredClientId = process.env.GOOGLE_CLIENT_ID;
  if (configuredClientId && configuredClientId !== 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
    if (googleData.aud && googleData.aud !== configuredClientId) {
      throw Object.assign(new Error('Google token audience mismatch.'), { statusCode: 401, code: 'GOOGLE_INVALID_CLIENT' });
    }
  }

  // 2. Safe Account Resolution & Account Takeover Prevention
  // First check if user already linked with this exact googleId
  let user = await prisma.user.findUnique({
    where: { googleId },
  });

  if (!user) {
    // Check if account already exists with this email address
    const existingByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingByEmail) {
      // If user is already bound to a DIFFERENT Google account, prevent takeover
      if (existingByEmail.googleId && existingByEmail.googleId !== googleId) {
        throw Object.assign(
          new Error('Account conflict: This email address is already associated with a different Google account.'),
          { statusCode: 409, code: 'ACCOUNT_TAKEOVER_PREVENTED' }
        );
      }

      // Safe link: Google verified the email, link googleId to existing password account
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId,
          avatarUrl: existingByEmail.avatarUrl || avatarUrl,
          isActive: true,
        },
      });
    } else {
      // Create new Google OAuth user
      const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      const uniqueUsername = `${baseUsername}_${uuidv4().slice(0, 6)}`;

      user = await prisma.user.create({
        data: {
          email,
          username: uniqueUsername,
          googleId,
          firstName: firstName || '',
          lastName: lastName || '',
          avatarUrl: avatarUrl || null,
          password: null, // Zero password for OAuth users
          isActive: true,
        },
      });

      // Initialize Profile
      await prisma.profile.create({
        data: { userId: user.id },
      }).catch(() => {});

      // Initialize Financial Profile
      await prisma.financialProfile.create({
        data: {
          userId: user.id,
          monthlySalary: 0,
          estimatedMonthlyExpenses: 0,
          currentSavings: 0,
          totalDebt: 0,
        },
      }).catch(() => {});

      // Initialize primary bank account
      await prisma.financialAccount.create({
        data: {
          userId: user.id,
          name: 'Primary Account',
          accountType: 'BANK',
          balance: 0,
          currency: 'INR',
        },
      });
    }
  } else {
    // If user was found by googleId, keep avatar up-to-date if present
    if (avatarUrl && !user.avatarUrl) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl },
      });
    }
  }

  if (!user.isActive) {
    throw Object.assign(new Error('Your account has been deactivated.'), { statusCode: 403, code: 'ACCOUNT_DEACTIVATED' });
  }

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const { accessToken, refreshToken } = generateTokens(user.id);
  await storeRefreshToken(user.id, refreshToken);

  return { user: sanitizeUser(user), accessToken, refreshToken };
};

/**
 * Get Google OAuth authorization URL with CSRF state protection
 */
const getGoogleAuthUrl = (state = null) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL || `${process.env.FRONTEND_URL || 'https://finpro-finance-ai-olvt.onrender.com'}/api/v1/auth/google/callback`;

  if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
    throw Object.assign(new Error('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID in .env or Render dashboard.'), { statusCode: 503, code: 'GOOGLE_NOT_CONFIGURED' });
  }

  const oauthState = state || generateOAuthState();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state: oauthState,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

/**
 * Exchange Google auth code for tokens and handle state validation
 */
const handleGoogleCallback = async (code, state = null) => {
  if (state) {
    verifyOAuthState(state);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL || `${process.env.FRONTEND_URL || 'https://finpro-finance-ai-olvt.onrender.com'}/api/v1/auth/google/callback`;

  if (!clientId || !clientSecret || clientId === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com' || clientSecret === 'YOUR_GOOGLE_CLIENT_SECRET') {
    throw Object.assign(new Error('Google OAuth is not configured.'), { statusCode: 503, code: 'GOOGLE_NOT_CONFIGURED' });
  }

  const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  }, {
    timeout: 10000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const { id_token, access_token } = tokenRes.data;
  return await googleAuth(id_token, access_token);
};

/**
 * Strip sensitive fields from user object
 */
const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  avatarUrl: user.avatarUrl,
  role: user.role,
  isPremium: user.isPremium,
  currency: user.currency,
  timezone: user.timezone,
  createdAt: user.createdAt,
});

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  googleAuth,
  generateOAuthState,
  verifyOAuthState,
  getGoogleAuthUrl,
  handleGoogleCallback,
  sanitizeUser,
};
