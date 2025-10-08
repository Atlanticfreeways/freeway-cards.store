const { sanitizeResponseData } = require('../middleware/responseSanitizer');

/**
 * Format a success response
 * @param {any} data - Response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const formatSuccessResponse = (data, message = null, statusCode = 200) => {
  const response = {
    success: true,
    data: data
  };

  if (message) {
    response.message = message;
  }

  return response;
};

/**
 * Format an error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Array} errors - Optional array of validation errors
 */
const formatErrorResponse = (message, statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message: message
  };

  if (errors) {
    response.errors = errors;
  }

  return response;
};

/**
 * Send a sanitized success response
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccessResponse = (res, data, message = null, statusCode = 200) => {
  const response = formatSuccessResponse(data, message);
  return res.status(statusCode).json(response);
};

/**
 * Send a sanitized error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Array} errors - Optional array of validation errors
 */
const sendErrorResponse = (res, message, statusCode = 500, errors = null) => {
  const response = formatErrorResponse(message, statusCode, errors);
  return res.status(statusCode).json(response);
};

module.exports = {
  formatSuccessResponse,
  formatErrorResponse,
  sendSuccessResponse,
  sendErrorResponse
};
