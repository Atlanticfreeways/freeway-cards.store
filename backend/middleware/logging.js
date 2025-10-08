const { logger, securityLogger } = require('../utils/logger');

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request
  logger.info('Request received', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous'
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id || 'anonymous'
    });
  });

  next();
};

// Security event logging
const logSecurityEvent = (event, details) => {
  securityLogger.info(event, details);
};

// Suspicious activity logger
const logSuspiciousActivity = (req, reason) => {
  securityLogger.warn('Suspicious activity detected', {
    reason,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
    headers: req.headers,
    body: req.body
  });
};

module.exports = {
  requestLogger,
  logSecurityEvent,
  logSuspiciousActivity
};
