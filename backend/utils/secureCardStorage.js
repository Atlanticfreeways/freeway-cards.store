const crypto = require('crypto');

/**
 * Secure Card Storage Utilities
 * Provides PCI DSS compliant encryption/decryption for sensitive card data
 */
class SecureCardStorage {
  constructor() {
    // Encryption configuration
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.tagLength = 16; // 128 bits
    
    // Get encryption key from environment (should be 64 hex characters)
    this.encryptionKey = this.getEncryptionKey();
    
    // Audit logger
    this.auditLog = require('./logger');
  }

  /**
   * Get or generate encryption key
   * @returns {Buffer} Encryption key
   */
  getEncryptionKey() {
    const keyHex = process.env.CARD_ENCRYPTION_KEY;
    
    if (!keyHex) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CARD_ENCRYPTION_KEY must be set in production');
      }
      
      // Generate a key for development (NOT for production use)
      console.warn('WARNING: Using generated encryption key for development only');
      return crypto.randomBytes(this.keyLength);
    }
    
    if (keyHex.length !== 64) {
      throw new Error('CARD_ENCRYPTION_KEY must be 64 hex characters (256 bits)');
    }
    
    return Buffer.from(keyHex, 'hex');
  }

  /**
   * Encrypt sensitive card data
   * @param {string} plaintext - Data to encrypt
   * @param {string} userId - User ID for audit logging
   * @param {string} cardId - Card ID for audit logging
   * @returns {string} Encrypted data (base64 encoded)
   */
  encryptCardData(plaintext, userId = null, cardId = null) {
    try {
      if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Invalid plaintext data');
      }

      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey, iv);
      
      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine IV + tag + encrypted data
      const combined = Buffer.concat([iv, tag, encrypted]);
      
      // Encode as base64
      const result = combined.toString('base64');
      
      // Audit log (without sensitive data)
      this.logCardAccess(userId, cardId, 'encrypt', 'success');
      
      return result;
      
    } catch (error) {
      this.logCardAccess(userId, cardId, 'encrypt', 'error', error.message);
      throw new Error('Encryption failed: ' + error.message);
    }
  }

  /**
   * Decrypt sensitive card data
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @param {string} userId - User ID for audit logging
   * @param {string} cardId - Card ID for audit logging
   * @returns {string} Decrypted plaintext
   */
  decryptCardData(encryptedData, userId = null, cardId = null) {
    try {
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data');
      }

      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');
      
      if (combined.length < this.ivLength + this.tagLength + 1) {
        throw new Error('Invalid encrypted data format');
      }
      
      // Extract components
      const iv = combined.slice(0, this.ivLength);
      const tag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.ivLength + this.tagLength);
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      const result = decrypted.toString('utf8');
      
      // Audit log (without sensitive data)
      this.logCardAccess(userId, cardId, 'decrypt', 'success');
      
      return result;
      
    } catch (error) {
      this.logCardAccess(userId, cardId, 'decrypt', 'error', error.message);
      throw new Error('Decryption failed: ' + error.message);
    }
  }

  /**
   * Mask card number for display purposes
   * @param {string} cardNumber - Full card number
   * @returns {string} Masked card number (e.g., "**** **** **** 1234")
   */
  maskCardNumber(cardNumber) {
    if (!cardNumber || typeof cardNumber !== 'string') {
      return '**** **** **** ****';
    }
    
    // Remove any spaces or dashes
    const cleanNumber = cardNumber.replace(/[\s-]/g, '');
    
    if (cleanNumber.length < 4) {
      return '**** **** **** ****';
    }
    
    // Show only last 4 digits
    const last4 = cleanNumber.slice(-4);
    const masked = '**** **** **** ' + last4;
    
    return masked;
  }

  /**
   * Mask CVV for display purposes
   * @param {string} cvv - CVV code
   * @returns {string} Masked CVV
   */
  maskCvv(cvv) {
    if (!cvv || typeof cvv !== 'string') {
      return '***';
    }
    
    return '*'.repeat(cvv.length);
  }

  /**
   * Get last 4 digits of card number
   * @param {string} cardNumber - Full card number
   * @returns {string} Last 4 digits
   */
  getLast4Digits(cardNumber) {
    if (!cardNumber || typeof cardNumber !== 'string') {
      return '****';
    }
    
    const cleanNumber = cardNumber.replace(/[\s-]/g, '');
    return cleanNumber.slice(-4);
  }

  /**
   * Validate card number format (basic Luhn algorithm)
   * @param {string} cardNumber - Card number to validate
   * @returns {boolean} Whether card number is valid
   */
  validateCardNumber(cardNumber) {
    if (!cardNumber || typeof cardNumber !== 'string') {
      return false;
    }
    
    const cleanNumber = cardNumber.replace(/[\s-]/g, '');
    
    // Check if all digits
    if (!/^\d+$/.test(cleanNumber)) {
      return false;
    }
    
    // Check length (13-19 digits for most cards)
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      return false;
    }
    
    // Luhn algorithm
    let sum = 0;
    let isEven = false;
    
    for (let i = cleanNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanNumber[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  }

  /**
   * Detect card brand from card number
   * @param {string} cardNumber - Card number
   * @returns {string} Card brand (visa, mastercard, amex, etc.)
   */
  detectCardBrand(cardNumber) {
    if (!cardNumber || typeof cardNumber !== 'string') {
      return 'unknown';
    }
    
    const cleanNumber = cardNumber.replace(/[\s-]/g, '');
    
    // Visa: starts with 4
    if (/^4/.test(cleanNumber)) {
      return 'visa';
    }
    
    // Mastercard: starts with 5 or 2221-2720
    if (/^5[1-5]/.test(cleanNumber) || /^2(22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720)/.test(cleanNumber)) {
      return 'mastercard';
    }
    
    // American Express: starts with 34 or 37
    if (/^3[47]/.test(cleanNumber)) {
      return 'amex';
    }
    
    // Discover: starts with 6
    if (/^6/.test(cleanNumber)) {
      return 'discover';
    }
    
    return 'unknown';
  }

  /**
   * Generate secure random card data for testing
   * @param {string} cardType - Card type (visa, mastercard)
   * @returns {Object} Generated card data
   */
  generateTestCardData(cardType = 'visa') {
    const testNumbers = {
      visa: '4111111111111111',
      mastercard: '5555555555554444'
    };
    
    const cardNumber = testNumbers[cardType] || testNumbers.visa;
    const expiryYear = (new Date().getFullYear() + 3).toString().slice(-2);
    const expiryMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const cvv = Math.floor(Math.random() * 900 + 100).toString();
    
    return {
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      brand: cardType
    };
  }

  /**
   * Log card access for audit compliance
   * @param {string} userId - User ID
   * @param {string} cardId - Card ID
   * @param {string} operation - Operation performed
   * @param {string} status - Operation status
   * @param {string} error - Error message if any
   */
  logCardAccess(userId, cardId, operation, status, error = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: userId || 'system',
      cardId: cardId || 'unknown',
      operation,
      status,
      ip: this.getCurrentIP(),
      userAgent: this.getCurrentUserAgent()
    };
    
    if (error) {
      logEntry.error = error;
    }
    
    // Log to audit system
    if (this.auditLog && this.auditLog.audit) {
      this.auditLog.audit('card_access', logEntry);
    } else {
      // Fallback to console in development
      console.log('[CARD_AUDIT]', JSON.stringify(logEntry));
    }
  }

  /**
   * Get current request IP (if available)
   * @returns {string} IP address
   */
  getCurrentIP() {
    // This would be set by middleware in a real request context
    return process.env.CURRENT_REQUEST_IP || 'unknown';
  }

  /**
   * Get current request user agent (if available)
   * @returns {string} User agent
   */
  getCurrentUserAgent() {
    // This would be set by middleware in a real request context
    return process.env.CURRENT_REQUEST_UA || 'unknown';
  }

  /**
   * Securely wipe sensitive data from memory
   * @param {Buffer|string} data - Data to wipe
   */
  secureWipe(data) {
    if (Buffer.isBuffer(data)) {
      data.fill(0);
    } else if (typeof data === 'string') {
      // Can't directly wipe strings in JavaScript, but we can try
      data = null;
    }
  }

  /**
   * Generate encryption key for initial setup
   * @returns {string} Hex-encoded encryption key
   */
  static generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Test encryption/decryption functionality
   * @returns {boolean} Whether encryption is working correctly
   */
  testEncryption() {
    try {
      const testData = 'test-card-data-' + Date.now();
      const encrypted = this.encryptCardData(testData);
      const decrypted = this.decryptCardData(encrypted);
      
      return testData === decrypted;
    } catch (error) {
      console.error('Encryption test failed:', error.message);
      return false;
    }
  }
}

module.exports = new SecureCardStorage();