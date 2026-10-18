/**
 * Global Error Handler Middleware
 * Owner: Jinay Golecha (jinay_golecha)
 */

const errorHandler = (err, req, res, next) => {
  // Log error server-side (never expose stack to client in production)
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[ERROR] ${req.method} ${req.path} — ${err.message}`);
    if (process.env.NODE_ENV === 'development') {
      console.error(err.stack);
    }
  }

  // Prisma-specific errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: `A record with that ${err.meta?.target?.join(', ')} already exists.`,
      },
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested record was not found.',
      },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token.' },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'Authentication token has expired.' },
    });
  }

  // Validation errors from express-validator
  if (err.type === 'VALIDATION_ERROR') {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details || [],
      },
    });
  }

  // Default error handler: preserve safe client error messages (4xx), mask unhandled server crashes (5xx)
  const statusCode = err.statusCode || err.status || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;
  return res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || (isClientError ? 'CLIENT_ERROR' : 'INTERNAL_ERROR'),
      message: (isClientError || process.env.NODE_ENV !== 'production')
        ? (err.message || 'Request failed.')
        : 'An internal server error occurred.',
    },
  });
};

/**
 * 404 Not Found handler — for unmatched routes
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found.`,
    },
  });
};

module.exports = { errorHandler, notFoundHandler };
