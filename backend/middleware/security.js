const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const { securityEventLogger } = require('./auditLogger');

// Rate limiting middleware
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { success: false, message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    securityEventLogger.rateLimitExceeded(req.ip, req.url);
    res.status(429).json({ success: false, message });
  }
});

// API rate limits
const apiLimiter = createRateLimit(15 * 60 * 1000, 100, 'Too many requests');
const authLimiter = createRateLimit(15 * 60 * 1000, 5, 'Too many auth attempts');
const cardLimiter = createRateLimit(60 * 60 * 1000, 10, 'Too many card operations');

// Input validation middleware
const validateInput = (schema) => (req, res, next) => {
  const errors = [];
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = req.body[field];
    
    if (rules.required && (!value || value.trim() === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    if (value) {
      if (rules.email && !validator.isEmail(value)) {
        errors.push(`${field} must be a valid email`);
      }
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} must be less than ${rules.maxLength} characters`);
      }
      if (rules.numeric && !validator.isNumeric(value.toString())) {
        errors.push(`${field} must be numeric`);
      }
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  
  next();
};

// Security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "https://apis.google.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  cardLimiter,
  validateInput,
  securityHeaders
};