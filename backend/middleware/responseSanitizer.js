const { sanitizeCardData, sanitizeUserData, sanitizeInput } = require('../utils/sanitizer');

/**
 * Middleware to sanitize API responses
 */
const sanitizeResponse = (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    // Deep sanitize the response data
    const sanitizedData = sanitizeResponseData(data);
    return originalJson.call(this, sanitizedData);
  };

  next();
};

/**
 * Recursively sanitize response data
 */
const sanitizeResponseData = (data) => {
  if (typeof data !== 'object' || data === null) {
    return typeof data === 'string' ? sanitizeInput(data) : data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponseData(item));
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(data)) {
    // Special handling for known data structures
    if (key === 'card' && value && typeof value === 'object') {
      sanitized[key] = sanitizeCardData(value);
    } else if (key === 'cards' && Array.isArray(value)) {
      sanitized[key] = value.map(card => sanitizeCardData(card));
    } else if (key === 'user' && value && typeof value === 'object') {
      sanitized[key] = sanitizeUserData(value);
    } else if (key === 'transactions' && Array.isArray(value)) {
      sanitized[key] = value.map(tx => ({
        ...tx,
        description: sanitizeInput(tx.description || ''),
        merchant: sanitizeInput(tx.merchant || ''),
        id: sanitizeInput(tx.id || ''),
        status: sanitizeInput(tx.status || '')
      }));
    } else {
      // Generic sanitization
      sanitized[key] = sanitizeResponseData(value);
    }
  }

  return sanitized;
};

module.exports = {
  sanitizeResponse,
  sanitizeResponseData
};
