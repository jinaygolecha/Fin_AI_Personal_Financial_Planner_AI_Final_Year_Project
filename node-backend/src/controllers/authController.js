const authService = require('../services/authService');
const prisma = require('../config/database');

/**
 * POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { email, username, password, firstName, lastName, phone } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email, username, and password are required.' },
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters.' },
      });
    }

    const result = await authService.register({ email, username, password, firstName, lastName, phone });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: result.user.id,
        action: 'USER_REGISTER',
        entity: 'User',
        entityId: result.user.id,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      },
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        message: 'Account created successfully!',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, username, emailOrUsername, password } = req.body;
    const identifier = (emailOrUsername || email || username || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email/username and password are required.' },
      });
    }

    const result = await authService.login({ emailOrUsername: identifier, password });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: result.user.id,
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: result.user.id,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        message: 'Login successful!',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/refresh
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required.' },
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);

    if (req.user?.id) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'USER_LOGOUT',
          entity: 'User',
          entityId: req.user.id,
          ipAddress: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
        },
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully.' },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isPremium: true,
        currency: true,
        timezone: true,
        country: true,
        createdAt: true,
        profile: true,
        financialProfile: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, phone, city, occupation, bio, monthlySalary, estimatedMonthlyExpenses, riskProfile } = req.body;

    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName !== undefined && { firstName: firstName.trim() }),
        ...(lastName !== undefined && { lastName: lastName.trim() }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
      },
    });

    if (occupation !== undefined || bio !== undefined) {
      await prisma.profile.upsert({
        where: { userId },
        update: {
          ...(occupation !== undefined && { occupation: occupation ? occupation.trim() : null }),
          ...(bio !== undefined && { bio: bio ? bio.trim() : null }),
        },
        create: {
          userId,
          occupation: occupation ? occupation.trim() : null,
          bio: bio ? bio.trim() : null,
        },
      });
    }

    if (city !== undefined || monthlySalary !== undefined || estimatedMonthlyExpenses !== undefined || riskProfile !== undefined) {
      await prisma.financialProfile.upsert({
        where: { userId },
        update: {
          ...(city !== undefined && { city: city ? city.trim() : 'Mumbai' }),
          ...(monthlySalary !== undefined && { monthlySalary: parseFloat(monthlySalary) || 0 }),
          ...(estimatedMonthlyExpenses !== undefined && { estimatedMonthlyExpenses: parseFloat(estimatedMonthlyExpenses) || 0 }),
          ...(riskProfile !== undefined && { riskProfile }),
        },
        create: {
          userId,
          city: city ? city.trim() : 'Mumbai',
          monthlySalary: parseFloat(monthlySalary) || 0,
          estimatedMonthlyExpenses: parseFloat(estimatedMonthlyExpenses) || 0,
          riskProfile: riskProfile || 'MODERATE',
        },
      });
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isPremium: true,
        currency: true,
        timezone: true,
        country: true,
        createdAt: true,
        profile: true,
        financialProfile: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/providers
 * Returns authentication providers configuration status
 */
const getAuthProviders = (req, res) => {
  const googleConfigured = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com' &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_SECRET !== 'YOUR_GOOGLE_CLIENT_SECRET'
  );

  return res.status(200).json({
    success: true,
    data: {
      password: true,
      google: {
        enabled: googleConfigured,
        clientId: googleConfigured ? process.env.GOOGLE_CLIENT_ID : null,
      },
    },
  });
};

/**
 * GET /api/v1/auth/google
 * Redirects to Google OAuth with CSRF state protection
 */
const googleAuthRedirect = (req, res, next) => {
  const host = req.get('host') || '127.0.0.1:5000';
  const protocol = req.protocol || 'http';
  const frontendUrl = (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes(':3000'))
    ? process.env.FRONTEND_URL
    : `${protocol}://${host}`;

  const acceptHeader = req.headers.accept || '';
  const isBrowserHtmlNav = acceptHeader.includes('text/html');

  const isConfigured = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com' &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_SECRET !== 'YOUR_GOOGLE_CLIENT_SECRET'
  );

  if (!isConfigured) {
    if (!isBrowserHtmlNav || req.query.format === 'json') {
      return res.status(503).json({
        success: false,
        error: {
          code: 'GOOGLE_NOT_CONFIGURED',
          message: 'Google OAuth is not configured. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in node-backend/.env or Render dashboard.',
        },
      });
    }
    return res.redirect(`${frontendUrl}/login.html?error=google_not_configured`);
  }

  try {
    const state = authService.generateOAuthState();
    const url = authService.getGoogleAuthUrl(state);
    return res.redirect(url);
  } catch (error) {
    if (error.code === 'GOOGLE_NOT_CONFIGURED') {
      if (!isBrowserHtmlNav || req.query.format === 'json') {
        return res.status(503).json({
          success: false,
          error: {
            code: 'GOOGLE_NOT_CONFIGURED',
            message: error.message,
          },
        });
      }
      return res.redirect(`${frontendUrl}/login.html?error=google_not_configured`);
    }
    next(error);
  }
};

/**
 * GET /api/v1/auth/google/callback
 * Handles Google OAuth callback with code exchange and state validation
 */
const googleAuthCallback = async (req, res, next) => {
  const host = req.get('host') || '127.0.0.1:5000';
  const protocol = req.protocol || 'http';
  const frontendUrl = (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes(':3000'))
    ? process.env.FRONTEND_URL
    : `${protocol}://${host}`;

  const { code, state, error: googleError } = req.query;

  // Handle user denied consent or Google error
  if (googleError === 'access_denied') {
    return res.redirect(`${frontendUrl}/login.html?error=consent_denied`);
  }
  if (googleError) {
    return res.redirect(`${frontendUrl}/login.html?error=${encodeURIComponent(googleError)}`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}/login.html?error=google_auth_failed`);
  }

  try {
    const result = await authService.handleGoogleCallback(code, state);
    const { accessToken, refreshToken, user } = result;

    // Audit Log
    if (user?.id) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_LOGIN_GOOGLE',
          entity: 'User',
          entityId: user.id,
          ipAddress: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
        },
      }).catch(() => {});
    }

    // Redirect to frontend with tokens in URL hash fragment for security (never exposed to server/logs)
    return res.redirect(`${frontendUrl}/dashboard.html#access_token=${accessToken}&refresh_token=${refreshToken}&google=true`);
  } catch (error) {
    console.error('Google callback error:', error.message);
    if (error.code === 'INVALID_OAUTH_STATE') {
      return res.redirect(`${frontendUrl}/login.html?error=invalid_oauth_state`);
    }
    if (error.code === 'ACCOUNT_TAKEOVER_PREVENTED') {
      return res.redirect(`${frontendUrl}/login.html?error=account_conflict`);
    }
    return res.redirect(`${frontendUrl}/login.html?error=google_auth_failed`);
  }
};

/**
 * POST /api/v1/auth/google/token
 * For frontend that uses Google Sign-In button with id_token
 */
const googleAuthWithToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Google ID token is required.' },
      });
    }

    const result = await authService.googleAuth(token);

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        message: 'Google login successful!',
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, refresh, logout, getMe, updateProfile, getAuthProviders, googleAuthRedirect, googleAuthCallback, googleAuthWithToken };
