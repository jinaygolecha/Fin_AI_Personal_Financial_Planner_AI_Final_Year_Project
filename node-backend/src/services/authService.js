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
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '60m' }
  );
  const refreshToken = jwt.sign(
    { userId },
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

  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });
};

/**
 * Register a new user
 */
const register = async ({ email, username, password, firstName = '', lastName = '', phone = '' }) => {
  // Check for existing user
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existingUser) {
    if (existingUser.email === email) {
      throw Object.assign(new Error('An account with this email already exists.'), { statusCode: 409, code: 'EMAIL_EXISTS' });
    }
    throw Object.assign(new Error('That username is already taken.'), { statusCode: 409, code: 'USERNAME_EXISTS' });
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      username: username.trim(),
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone || null,
    },
  });

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
 * Google OAuth — verify Google ID token and create/find user
 */
const googleAuth = async (idToken) => {
  // Verify with Google tokeninfo endpoint
  const googleRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
  const { email, given_name: firstName, family_name: lastName, sub: googleId, picture: avatarUrl } = googleRes.data;

  if (!email) {
    throw Object.assign(new Error('Google account does not have an email address.'), { statusCode: 400, code: 'GOOGLE_NO_EMAIL' });
  }

  // Validate audience if CLIENT_ID is configured
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId && clientId !== 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
    if (googleRes.data.aud !== clientId) {
      throw Object.assign(new Error('Google token audience mismatch.'), { statusCode: 401, code: 'GOOGLE_INVALID_CLIENT' });
    }
  }

  // Find or create user
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email: email.toLowerCase() }] },
  });

  if (!user) {
    const username = email.split('@')[0] + '_' + uuidv4().slice(0, 6);
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        googleId,
        firstName: firstName || '',
        lastName: lastName || '',
        avatarUrl: avatarUrl || null,
        password: null, // No password for OAuth users
      },
    });

    // Create default account
    await prisma.financialAccount.create({
      data: { userId: user.id, name: 'Primary Account', accountType: 'BANK', balance: 0, currency: 'INR' },
    });
  } else if (!user.googleId) {
    // Link existing email account to Google
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId, avatarUrl: avatarUrl || user.avatarUrl },
    });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { accessToken, refreshToken } = generateTokens(user.id);
  await storeRefreshToken(user.id, refreshToken);

  return { user: sanitizeUser(user), accessToken, refreshToken };
};

/**
 * Get Google OAuth authorization URL
 */
const getGoogleAuthUrl = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
    throw Object.assign(new Error('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID in .env'), { statusCode: 503, code: 'GOOGLE_NOT_CONFIGURED' });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

/**
 * Exchange Google auth code for tokens
 */
const handleGoogleCallback = async (code) => {
  const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const { id_token } = tokenRes.data;
  return await googleAuth(id_token);
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
  getGoogleAuthUrl,
  handleGoogleCallback,
  sanitizeUser,
};
