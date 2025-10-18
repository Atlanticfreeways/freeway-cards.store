const User = require('../models/User');
const KYC = require('../models/KYC');

/**
 * KYC Validation Service
 * Handles user verification validation for card creation and compliance
 */
class KYCValidationService {
  constructor() {
    this.logger = require('../utils/logger');
    
    // KYC requirements for different card operations
    this.requirements = {
      cardCreation: {
        minLevel: 'basic',
        requiredStatus: 'approved',
        requiredDocuments: ['idDocument']
      },
      highValueCard: {
        minLevel: 'enhanced',
        requiredStatus: 'approved',
        requiredDocuments: ['idDocument', 'proofOfAddress']
      },
      premiumFeatures: {
        minLevel: 'premium',
        requiredStatus: 'approved',
        requiredDocuments: ['idDocument', 'proofOfAddress']
      }
    };
  }

  /**
   * Validate user KYC status for card creation
   * @param {string} userId - User ID
   * @param {Object} cardData - Card creation data
   * @returns {Promise<Object>} Validation result
   */
  async validateForCardCreation(userId, cardData = {}) {
    try {
      this.logger.info('Validating KYC for card creation', { userId });

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const kyc = await KYC.findOne({ userId });
      
      // Determine required KYC level based on card data
      const requiredLevel = this.determineRequiredKYCLevel(cardData);
      const requirements = this.requirements[requiredLevel];

      // Validate KYC status
      const validation = {
        isValid: false,
        user: {
          id: user._id,
          email: user.email,
          kycStatus: user.kycStatus
        },
        kyc: null,
        requirements: requirements,
        issues: []
      };

      // Check if user has started KYC
      if (user.kycStatus === 'not_started') {
        validation.issues.push({
          type: 'kyc_not_started',
          message: 'KYC verification not started',
          action: 'Start KYC verification process'
        });
        return validation;
      }

      // Check if KYC is pending
      if (user.kycStatus === 'pending') {
        validation.issues.push({
          type: 'kyc_pending',
          message: 'KYC verification is pending review',
          action: 'Wait for KYC approval'
        });
        return validation;
      }

      // Check if KYC was rejected
      if (user.kycStatus === 'rejected') {
        validation.issues.push({
          type: 'kyc_rejected',
          message: 'KYC verification was rejected',
          action: 'Resubmit KYC documentation',
          rejectionReason: kyc?.rejectionReason
        });
        return validation;
      }

      // User KYC is approved, now validate details
      if (user.kycStatus === 'approved' && kyc) {
        validation.kyc = {
          level: kyc.level,
          status: kyc.status,
          verificationDate: kyc.verificationDate,
          limits: kyc.limits
        };

        // Check KYC level requirement
        if (!this.isKYCLevelSufficient(kyc.level, requirements.minLevel)) {
          validation.issues.push({
            type: 'insufficient_kyc_level',
            message: `KYC level '${kyc.level}' insufficient, '${requirements.minLevel}' required`,
            action: `Upgrade KYC to ${requirements.minLevel} level`
          });
        }

        // Check required documents
        const missingDocs = this.checkRequiredDocuments(kyc, requirements.requiredDocuments);
        if (missingDocs.length > 0) {
          validation.issues.push({
            type: 'missing_documents',
            message: `Missing required documents: ${missingDocs.join(', ')}`,
            action: 'Upload missing documents',
            missingDocuments: missingDocs
          });
        }

        // Check spending limits for card type
        const limitsValidation = this.validateSpendingLimits(kyc, cardData);
        if (!limitsValidation.isValid) {
          validation.issues.push({
            type: 'spending_limits_exceeded',
            message: limitsValidation.message,
            action: 'Upgrade KYC level or reduce card limits',
            requestedLimits: cardData.spendingLimits,
            allowedLimits: kyc.limits
          });
        }

        // If no issues, validation passes
        if (validation.issues.length === 0) {
          validation.isValid = true;
        }
      }

      this.logger.info('KYC validation completed', {
        userId,
        isValid: validation.isValid,
        issueCount: validation.issues.length
      });

      return validation;

    } catch (error) {
      this.logger.error('KYC validation failed', { userId, error: error.message });
      throw new Error(`KYC validation failed: ${error.message}`);
    }
  }

  /**
   * Get KYC compliance limits for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Compliance limits
   */
  async getComplianceLimits(userId) {
    try {
      const user = await User.findById(userId);
      const kyc = await KYC.findOne({ userId });

      if (!user || !kyc || user.kycStatus !== 'approved') {
        return this.getDefaultLimits();
      }

      return {
        cardCreation: {
          maxCards: kyc.limits.cardCount || 3,
          maxDailySpending: kyc.limits.dailySpending || 1000,
          maxMonthlySpending: kyc.limits.monthlySpending || 5000
        },
        funding: {
          maxDailyFunding: this.getFundingLimit(kyc.level, 'daily'),
          maxMonthlyFunding: this.getFundingLimit(kyc.level, 'monthly')
        },
        features: {
          cryptoFunding: kyc.level !== 'basic',
          internationalTransactions: kyc.level === 'premium',
          businessFeatures: kyc.level === 'premium'
        }
      };

    } catch (error) {
      this.logger.error('Get compliance limits failed', { userId, error: error.message });
      return this.getDefaultLimits();
    }
  }

  /**
   * Check if user can perform specific card operation
   * @param {string} userId - User ID
   * @param {string} operation - Operation type
   * @param {Object} operationData - Operation specific data
   * @returns {Promise<Object>} Permission check result
   */
  async checkOperationPermission(userId, operation, operationData = {}) {
    try {
      const validation = await this.validateForCardCreation(userId, operationData);
      
      const permission = {
        allowed: false,
        reason: null,
        requirements: null
      };

      switch (operation) {
        case 'create_card':
          permission.allowed = validation.isValid;
          if (!permission.allowed) {
            permission.reason = validation.issues[0]?.message || 'KYC validation failed';
            permission.requirements = validation.issues;
          }
          break;

        case 'fund_card':
          const limits = await this.getComplianceLimits(userId);
          const requestedAmount = operationData.amount || 0;
          
          if (requestedAmount > limits.funding.maxDailyFunding) {
            permission.reason = `Daily funding limit exceeded (${limits.funding.maxDailyFunding})`;
          } else {
            permission.allowed = validation.isValid;
          }
          break;

        case 'crypto_funding':
          const complianceLimits = await this.getComplianceLimits(userId);
          permission.allowed = validation.isValid && complianceLimits.features.cryptoFunding;
          if (!permission.allowed) {
            permission.reason = 'Enhanced KYC required for crypto funding';
          }
          break;

        default:
          permission.allowed = validation.isValid;
      }

      return permission;

    } catch (error) {
      this.logger.error('Operation permission check failed', { userId, operation, error: error.message });
      return {
        allowed: false,
        reason: 'Permission check failed',
        error: error.message
      };
    }
  }

  /**
   * Update user KYC status
   * @param {string} userId - User ID
   * @param {string} status - New KYC status
   * @param {string} reason - Reason for status change
   * @returns {Promise<Object>} Update result
   */
  async updateKYCStatus(userId, status, reason = '') {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const oldStatus = user.kycStatus;
      user.kycStatus = status;
      await user.save();

      // Update KYC record if exists
      const kyc = await KYC.findOne({ userId });
      if (kyc) {
        kyc.status = status === 'approved' ? 'approved' : status;
        if (status === 'approved') {
          kyc.verificationDate = new Date();
        }
        if (status === 'rejected' && reason) {
          kyc.rejectionReason = reason;
        }
        await kyc.save();
      }

      this.logger.info('KYC status updated', {
        userId,
        oldStatus,
        newStatus: status,
        reason
      });

      return {
        success: true,
        userId,
        oldStatus,
        newStatus: status,
        updatedAt: new Date()
      };

    } catch (error) {
      this.logger.error('KYC status update failed', { userId, status, error: error.message });
      throw new Error(`KYC status update failed: ${error.message}`);
    }
  }

  // Helper methods

  /**
   * Determine required KYC level based on card data
   * @param {Object} cardData - Card creation data
   * @returns {string} Required KYC level key
   */
  determineRequiredKYCLevel(cardData) {
    const spendingLimits = cardData.spendingLimits || {};
    
    // High value cards require enhanced KYC
    if (spendingLimits.daily > 2000 || spendingLimits.monthly > 10000) {
      return 'highValueCard';
    }

    // Premium features require premium KYC
    if (cardData.features?.includes('international') || cardData.features?.includes('business')) {
      return 'premiumFeatures';
    }

    // Default to basic card creation requirements
    return 'cardCreation';
  }

  /**
   * Check if KYC level is sufficient
   * @param {string} userLevel - User's KYC level
   * @param {string} requiredLevel - Required KYC level
   * @returns {boolean} Whether level is sufficient
   */
  isKYCLevelSufficient(userLevel, requiredLevel) {
    const levels = ['basic', 'enhanced', 'premium'];
    const userLevelIndex = levels.indexOf(userLevel);
    const requiredLevelIndex = levels.indexOf(requiredLevel);
    
    return userLevelIndex >= requiredLevelIndex;
  }

  /**
   * Check required documents
   * @param {Object} kyc - KYC record
   * @param {Array} requiredDocs - Required document types
   * @returns {Array} Missing document types
   */
  checkRequiredDocuments(kyc, requiredDocs) {
    const missing = [];
    
    for (const docType of requiredDocs) {
      const doc = kyc.documents[docType];
      if (!doc || !doc.verified || !doc.url) {
        missing.push(docType);
      }
    }
    
    return missing;
  }

  /**
   * Validate spending limits against KYC limits
   * @param {Object} kyc - KYC record
   * @param {Object} cardData - Card data with spending limits
   * @returns {Object} Validation result
   */
  validateSpendingLimits(kyc, cardData) {
    const requestedLimits = cardData.spendingLimits || {};
    const kycLimits = kyc.limits || {};

    if (requestedLimits.daily && requestedLimits.daily > kycLimits.dailySpending) {
      return {
        isValid: false,
        message: `Requested daily limit (${requestedLimits.daily}) exceeds KYC limit (${kycLimits.dailySpending})`
      };
    }

    if (requestedLimits.monthly && requestedLimits.monthly > kycLimits.monthlySpending) {
      return {
        isValid: false,
        message: `Requested monthly limit (${requestedLimits.monthly}) exceeds KYC limit (${kycLimits.monthlySpending})`
      };
    }

    return { isValid: true };
  }

  /**
   * Get funding limits based on KYC level
   * @param {string} kycLevel - KYC level
   * @param {string} period - Time period (daily, monthly)
   * @returns {number} Funding limit
   */
  getFundingLimit(kycLevel, period) {
    const limits = {
      basic: { daily: 1000, monthly: 5000 },
      enhanced: { daily: 5000, monthly: 25000 },
      premium: { daily: 10000, monthly: 100000 }
    };

    return limits[kycLevel]?.[period] || limits.basic[period];
  }

  /**
   * Get default compliance limits
   * @returns {Object} Default limits
   */
  getDefaultLimits() {
    return {
      cardCreation: {
        maxCards: 1,
        maxDailySpending: 500,
        maxMonthlySpending: 2000
      },
      funding: {
        maxDailyFunding: 500,
        maxMonthlyFunding: 2000
      },
      features: {
        cryptoFunding: false,
        internationalTransactions: false,
        businessFeatures: false
      }
    };
  }
}

module.exports = new KYCValidationService();