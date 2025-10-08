const { logger, securityLogger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const errorDetails = {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };

  logger.error('Error occurred:', errorDetails);

  // Security monitoring - log potential security issues
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    securityLogger.warn('Authentication error:', {
      type: err.name,
      message: err.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
  }

  if (err.code === 'EBADCSRFTOKEN') {
    securityLogger.warn('CSRF token violation:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      userId: req.user?.id || 'anonymous'
    });
  }

  // CSRF error
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token'
    });
  }

  // Validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  // Token expired error
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token has expired'
    });
  }

  // MongoDB errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    logger.error('Database error:', {
      ...errorDetails,
      code: err.code,
      codeName: err.codeName
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;