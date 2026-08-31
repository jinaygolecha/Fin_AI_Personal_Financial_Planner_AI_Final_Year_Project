/**
 * Structured Request Logging Middleware
 * Jinay Finance AI
 * Excludes sensitive fields (passwords, tokens, API keys)
 */

const { v4: uuidv4 } = require('uuid');

const requestLogger = (req, res, next) => {
  const requestId = uuidv4();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startTime = process.hrtime();

  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return;

    const diff = process.hrtime(startTime);
    const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

    // Use appropriate log level based on status
    if (res.statusCode >= 500) {
      console.error(`[REQ-ERROR] ${req.method} ${req.path} ${res.statusCode} ${durationMs}ms - RequestId: ${requestId}`);
    } else if (res.statusCode >= 400) {
      console.warn(`[REQ-WARN] ${req.method} ${req.path} ${res.statusCode} ${durationMs}ms`);
    } else {
      console.log(`[REQ-INFO] ${req.method} ${req.path} ${res.statusCode} ${durationMs}ms`);
    }
  });

  next();
};

module.exports = requestLogger;
