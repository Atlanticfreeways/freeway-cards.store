/**
 * Abstract base class for card issuer integrations
 * Provides a standardized interface for different card issuer providers
 */
class CardIssuerAdapter {
  constructor(config) {
    if (this.constructor === CardIssuerAdapter) {
      throw new Error('CardIssuerAdapter is an abstract class and cannot be instantiated directly');
    }
    
    this.config = config;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.environment = config.environment || 'sandbox';
  }

  /**
   * Create a new virtual card
   * @param {Object} userProfile - User profile information
   * @param {Object} cardConfig - Card configuration options
   * @returns {Promise<Object>} Card creation response
   */
  async createCard(userProfile, cardConfig) {
    throw new Error('createCard method must be implemented by subclass');
  }

  /**
   * Update card status (active, frozen, suspended, closed)
   * @param {string} cardId - External card identifier
   * @param {string} status - New card status
   * @param {string} reason - Reason for status change
   * @returns {Promise<Object>} Status update response
   */
  async updateCardStatus(cardId, status, reason = '') {
    throw new Error('updateCardStatus method must be implemented by subclass');
  }

  /**
   * Set spending limits for a card
   * @param {string} cardId - External card identifier
   * @param {Object} limits - Spending limits configuration
   * @returns {Promise<Object>} Limits update response
   */
  async setSpendingLimits(cardId, limits) {
    throw new Error('setSpendingLimits method must be implemented by subclass');
  }

  /**
   * Get card details and current status
   * @param {string} cardId - External card identifier
   * @returns {Promise<Object>} Card details
   */
  async getCardDetails(cardId) {
    throw new Error('getCardDetails method must be implemented by subclass');
  }

  /**
   * Get transaction history for a card
   * @param {string} cardId - External card identifier
   * @param {Object} filters - Transaction filters (date range, amount, etc.)
   * @returns {Promise<Array>} Transaction history
   */
  async getTransactionHistory(cardId, filters = {}) {
    throw new Error('getTransactionHistory method must be implemented by subclass');
  }

  /**
   * Load funds onto a card
   * @param {string} cardId - External card identifier
   * @param {number} amount - Amount to load (in cents)
   * @param {Object} source - Funding source information
   * @returns {Promise<Object>} Funding response
   */
  async loadFunds(cardId, amount, source) {
    throw new Error('loadFunds method must be implemented by subclass');
  }

  /**
   * Validate webhook signature for security
   * @param {string} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @param {string} secret - Webhook secret
   * @returns {boolean} Signature validation result
   */
  validateWebhookSignature(payload, signature, secret) {
    throw new Error('validateWebhookSignature method must be implemented by subclass');
  }

  /**
   * Process webhook event
   * @param {Object} event - Webhook event data
   * @returns {Promise<Object>} Processing result
   */
  async processWebhookEvent(event) {
    throw new Error('processWebhookEvent method must be implemented by subclass');
  }

  /**
   * Standardized error handling for API responses
   * @param {Error} error - Original error
   * @param {string} operation - Operation that failed
   * @returns {Error} Standardized error
   */
  handleApiError(error, operation) {
    const errorMessage = `${operation} failed: ${error.message}`;
    
    // Categorize errors for better handling
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 400:
          return new Error(`Bad Request - ${errorMessage}: ${JSON.stringify(data)}`);
        case 401:
          return new Error(`Authentication Failed - ${errorMessage}`);
        case 403:
          return new Error(`Authorization Failed - ${errorMessage}`);
        case 404:
          return new Error(`Resource Not Found - ${errorMessage}`);
        case 429:
          return new Error(`Rate Limited - ${errorMessage}`);
        case 500:
        case 502:
        case 503:
        case 504:
          return new Error(`Server Error - ${errorMessage}`);
        default:
          return new Error(`API Error (${status}) - ${errorMessage}`);
      }
    }
    
    // Network or other errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new Error(`Network Error - ${errorMessage}`);
    }
    
    return new Error(`Unknown Error - ${errorMessage}`);
  }

  /**
   * Retry mechanism with exponential backoff
   * @param {Function} operation - Operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise<any>} Operation result
   */
  async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain error types
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        // Don't wait after the last attempt
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Check if an error should not be retried
   * @param {Error} error - Error to check
   * @returns {boolean} Whether the error is non-retryable
   */
  isNonRetryableError(error) {
    // Don't retry authentication, authorization, or validation errors
    const nonRetryablePatterns = [
      /Authentication Failed/,
      /Authorization Failed/,
      /Bad Request/,
      /Resource Not Found/
    ];
    
    return nonRetryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Log API operations for audit and debugging
   * @param {string} operation - Operation name
   * @param {Object} data - Operation data
   * @param {string} level - Log level (info, warn, error)
   */
  log(operation, data, level = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      provider: this.constructor.name,
      operation,
      environment: this.environment,
      ...data
    };
    
    // In production, this would integrate with your logging system
    console[level](`[${this.constructor.name}] ${operation}:`, logEntry);
  }
}

module.exports = CardIssuerAdapter;