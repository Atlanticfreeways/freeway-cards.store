const VirtualCard = require('../models/VirtualCard');
const User = require('../models/User');
const cardIssuerConfig = require('../config/cardIssuer');
const secureCardStorage = require('../utils/secureCardStorage');
const kycValidationService = require('./kycValidationService');

/**
 * Production Card Service
 * Handles real card creation and management using card issuer APIs
 */
class ProductionCardService {
  constructor() {
    this.adapter = null;
    this.logger = require('../utils/logger');
  }

  /**
   * Get card issuer adapter instance
   * @param {string} provider - Optional provider override
   * @returns {CardIssuerAdapter} Adapter instance
   */
  getAdapter(provider = null) {
    if (!this.adapter || provider) {
      this.adapter = cardIssuerConfig.getAdapter(provider);
    }
    return this.adapter;
  }

  /**
   * Create a new virtual card with real card issuer integration
   * @param {string} userId - User ID
   * @param {Object} cardData - Card configuration
   * @returns {Promise<Object>} Created card details
   */
  async createVirtualCard(userId, cardData) {
    try {
      this.logger.info('Creating virtual card', { userId, cardType: cardData.cardType });

      // Validate user and KYC status
      const user = await this.validateUserForCardCreation(userId, cardData);
      
      // Prepare user profile for card issuer
      const userProfile = {
        userId: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        kycVerified: user.kycStatus === 'verified'
      };

      // Prepare card configuration
      const cardConfig = {
        cardType: cardData.cardType,
        cardName: cardData.cardName || `${cardData.cardType.toUpperCase()} Card`,
        spendingLimits: {
          daily: cardData.spendingLimits?.daily || 1000,
          monthly: cardData.spendingLimits?.monthly || 5000,
          perTransaction: cardData.spendingLimits?.perTransaction || 500
        }
      };

      // Create card with issuer
      const adapter = this.getAdapter();
      const issuerResponse = await adapter.createCard(userProfile, cardConfig);

      // Create card record in database
      const virtualCard = new VirtualCard({
        userId: user._id,
        issuerProvider: cardIssuerConfig.defaultProvider,
        issuerCardId: issuerResponse.externalCardId,
        issuerCardToken: issuerResponse.issuerData?.cardToken,
        cardType: cardData.cardType,
        cardName: cardConfig.cardName,
        expiryMonth: issuerResponse.expiryMonth,
        expiryYear: issuerResponse.expiryYear,
        spendingLimits: cardConfig.spendingLimits,
        status: issuerResponse.status,
        kycVerified: userProfile.kycVerified,
        merchantCategories: cardData.merchantCategories || ['all']
      });

      // Set encrypted card data
      virtualCard.setCardNumber(issuerResponse.cardNumber);
      virtualCard.setCvv(issuerResponse.cvv);

      // Save to database
      await virtualCard.save();

      this.logger.info('Virtual card created successfully', {
        userId,
        cardId: virtualCard._id,
        issuerCardId: issuerResponse.externalCardId
      });

      // Return safe card object (without sensitive data)
      return {
        cardId: virtualCard._id,
        issuerCardId: issuerResponse.externalCardId,
        cardType: virtualCard.cardType,
        cardName: virtualCard.cardName,
        last4Digits: virtualCard.last4Digits,
        expiryMonth: virtualCard.expiryMonth,
        expiryYear: virtualCard.expiryYear,
        status: virtualCard.status,
        spendingLimits: virtualCard.spendingLimits,
        balance: virtualCard.balance,
        maskedCardNumber: virtualCard.maskedCardNumber,
        createdAt: virtualCard.createdAt
      };

    } catch (error) {
      this.logger.error('Card creation failed', { userId, error: error.message });
      throw new Error(`Card creation failed: ${error.message}`);
    }
  }

  /**
   * Activate a pending card
   * @param {string} cardId - Card ID
   * @returns {Promise<Object>} Activation result
   */
  async activateCard(cardId) {
    try {
      const card = await VirtualCard.findById(cardId);
      if (!card) {
        throw new Error('Card not found');
      }

      if (card.status !== 'pending') {
        throw new Error(`Card is already ${card.status}`);
      }

      const adapter = this.getAdapter(card.issuerProvider);
      const result = await adapter.updateCardStatus(card.issuerCardId, 'active', 'User activation');

      // Update local card status
      card.updateStatus('active', 'Activated by user');
      await card.save();

      this.logger.info('Card activated', { cardId, issuerCardId: card.issuerCardId });

      return {
        success: true,
        cardId: card._id,
        status: card.status,
        activatedAt: new Date()
      };

    } catch (error) {
      this.logger.error('Card activation failed', { cardId, error: error.message });
      throw new Error(`Card activation failed: ${error.message}`);
    }
  }

  /**
   * Freeze a card
   * @param {string} cardId - Card ID
   * @param {string} reason - Reason for freezing
   * @returns {Promise<Object>} Freeze result
   */
  async freezeCard(cardId, reason = 'User request') {
    try {
      const card = await VirtualCard.findById(cardId);
      if (!card) {
        throw new Error('Card not found');
      }

      if (card.status === 'frozen') {
        return { success: true, message: 'Card is already frozen' };
      }

      const adapter = this.getAdapter(card.issuerProvider);
      const result = await adapter.updateCardStatus(card.issuerCardId, 'frozen', reason);

      // Update local card status
      card.updateStatus('frozen', reason);
      await card.save();

      this.logger.info('Card frozen', { cardId, issuerCardId: card.issuerCardId, reason });

      return {
        success: true,
        cardId: card._id,
        status: card.status,
        reason: reason,
        frozenAt: new Date()
      };

    } catch (error) {
      this.logger.error('Card freeze failed', { cardId, error: error.message });
      throw new Error(`Card freeze failed: ${error.message}`);
    }
  }

  /**
   * Unfreeze a card
   * @param {string} cardId - Card ID
   * @param {string} reason - Reason for unfreezing
   * @returns {Promise<Object>} Unfreeze result
   */
  async unfreezeCard(cardId, reason = 'User request') {
    try {
      const card = await VirtualCard.findById(cardId);
      if (!card) {
        throw new Error('Card not found');
      }

      if (card.status !== 'frozen') {
        throw new Error(`Card is ${card.status}, not frozen`);
      }

      const adapter = this.getAdapter(card.issuerProvider);
      const result = await adapter.updateCardStatus(card.issuerCardId, 'active', reason);

      // Update local card status
      card.updateStatus('active', reason);
      await card.save();

      this.logger.info('Card unfrozen', { cardId, issuerCardId: card.issuerCardId, reason });

      return {
        success: true,
        cardId: card._id,
        status: card.status,
        reason: reason,
        unfrozenAt: new Date()
      };

    } catch (error) {
      this.logger.error('Card unfreeze failed', { cardId, error: error.message });
      throw new Error(`Card unfreeze failed: ${error.message}`);
    }
  }

  /**
   * Update spending limits for a card
   * @param {string} cardId - Card ID
   * @param {Object} limits - New spending limits
   * @returns {Promise<Object>} Update result
   */
  async updateSpendingLimits(cardId, limits) {
    try {
      const card = await VirtualCard.findById(cardId);
      if (!card) {
        throw new Error('Card not found');
      }

      // Validate limits
      this.validateSpendingLimits(limits);

      const adapter = this.getAdapter(card.issuerProvider);
      const result = await adapter.setSpendingLimits(card.issuerCardId, limits);

      // Update local card limits
      card.updateSpendingLimits(limits);
      await card.save();

      this.logger.info('Spending limits updated', { cardId, limits });

      return {
        success: true,
        cardId: card._id,
        spendingLimits: card.spendingLimits,
        updatedAt: new Date()
      };

    } catch (error) {
      this.logger.error('Spending limits update failed', { cardId, error: error.message });
      throw new Error(`Spending limits update failed: ${error.message}`);
    }
  }

  /**
   * Fund a card with specified amount
   * @param {string} cardId - Card ID
   * @param {number} amount - Amount to fund (in cents)
   * @param {Object} source - Funding source information
   * @returns {Promise<Object>} Funding result
   */
  async fundCard(cardId, amount, source) {
    try {
      const card = await VirtualCard.findById(cardId);
      if (!card) {
        throw new Error('Card not found');
      }

      if (card.status !== 'active') {
        throw new Error(`Cannot fund ${card.status} card`);
      }

      // Validate amount
      if (amount <= 0 || amount > 1000000) { // Max $10,000
        throw new Error('Invalid funding amount');
      }

      const adapter = this.getAdapter(card.issuerProvider);
      const result = await adapter.loadFunds(card.issuerCardId, amount, source);

      // Update local card balance
      card.balance += (amount / 100); // Convert cents to dollars
      await card.save();

      this.logger.info('Card funded', { cardId, amount: amount / 100, source: source.type });

      return {
        success: true,
        cardId: card._id,
        amount: amount / 100,
        newBalance: card.balance,
        fundedAt: new Date(),
        reference: result.orderToken || result.reference
      };

    } catch (error) {
      this.logger.error('Card funding failed', { cardId, error: error.message });
      throw new Error(`Card funding failed: ${error.message}`);
    }
  }

  /**
   * Get card details with real-time sync
   * @param {string} cardId - Card ID
   * @param {boolean} includeDecryptedData - Whether to include decrypted card data
   * @returns {Promise<Object>} Card details
   */
  async getCardDetails(cardId, includeDecryptedData = false) {
    try {
      const card = await VirtualCard.findById(cardId);
      if (!card) {
        throw new Error('Card not found');
      }

      // Sync with card issuer if needed
      if (this.shouldSyncCard(card)) {
        await this.syncCardWithIssuer(card);
      }

      const cardDetails = card.toSafeObject();

      // Include decrypted data if requested (for authorized operations)
      if (includeDecryptedData) {
        cardDetails.cardNumber = card.getDecryptedCardNumber();
        cardDetails.cvv = card.getDecryptedCvv();
      }

      return cardDetails;

    } catch (error) {
      this.logger.error('Get card details failed', { cardId, error: error.message });
      throw new Error(`Get card details failed: ${error.message}`);
    }
  }

  /**
   * Get transaction history for a card
   * @param {string} cardId - Card ID
   * @param {Object} filters - Transaction filters
   * @returns {Promise<Array>} Transaction history
   */
  async getTransactionHistory(cardId, filters = {}) {
    try {
      const card = await VirtualCard.findById(cardId);
      if (!card) {
        throw new Error('Card not found');
      }

      const adapter = this.getAdapter(card.issuerProvider);
      const transactions = await adapter.getTransactionHistory(card.issuerCardId, filters);

      this.logger.info('Retrieved transaction history', { cardId, count: transactions.length });

      return transactions;

    } catch (error) {
      this.logger.error('Get transaction history failed', { cardId, error: error.message });
      throw new Error(`Get transaction history failed: ${error.message}`);
    }
  }

  // Helper methods

  /**
   * Validate user for card creation
   * @param {string} userId - User ID
   * @param {Object} cardData - Card creation data
   * @returns {Promise<Object>} User object
   */
  async validateUserForCardCreation(userId, cardData = {}) {
    // Validate KYC status and compliance
    const kycValidation = await kycValidationService.validateForCardCreation(userId, cardData);
    
    if (!kycValidation.isValid) {
      const primaryIssue = kycValidation.issues[0];
      throw new Error(primaryIssue?.message || 'KYC validation failed for card creation');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get compliance limits
    const complianceLimits = await kycValidationService.getComplianceLimits(userId);

    // Check if user has reached card limit
    const existingCards = await VirtualCard.countDocuments({
      userId: user._id,
      status: { $in: ['active', 'frozen', 'pending'] }
    });

    if (existingCards >= complianceLimits.cardCreation.maxCards) {
      throw new Error(`Maximum number of cards (${complianceLimits.cardCreation.maxCards}) reached for your KYC level`);
    }

    // Validate requested spending limits against KYC limits
    if (cardData.spendingLimits) {
      if (cardData.spendingLimits.daily > complianceLimits.cardCreation.maxDailySpending) {
        throw new Error(`Requested daily limit exceeds your KYC limit of $${complianceLimits.cardCreation.maxDailySpending}`);
      }
      if (cardData.spendingLimits.monthly > complianceLimits.cardCreation.maxMonthlySpending) {
        throw new Error(`Requested monthly limit exceeds your KYC limit of $${complianceLimits.cardCreation.maxMonthlySpending}`);
      }
    }

    // Add compliance limits to user object for reference
    user.complianceLimits = complianceLimits;
    user.kycValidation = kycValidation;

    return user;
  }

  /**
   * Validate spending limits
   * @param {Object} limits - Spending limits to validate
   */
  validateSpendingLimits(limits) {
    if (limits.daily && (limits.daily < 0 || limits.daily > 10000)) {
      throw new Error('Daily limit must be between $0 and $10,000');
    }
    if (limits.monthly && (limits.monthly < 0 || limits.monthly > 50000)) {
      throw new Error('Monthly limit must be between $0 and $50,000');
    }
    if (limits.perTransaction && (limits.perTransaction < 0 || limits.perTransaction > 5000)) {
      throw new Error('Per-transaction limit must be between $0 and $5,000');
    }

    // Ensure monthly >= daily
    if (limits.daily && limits.monthly && limits.monthly < limits.daily) {
      throw new Error('Monthly limit cannot be less than daily limit');
    }

    // Ensure daily >= per-transaction
    if (limits.daily && limits.perTransaction && limits.daily < limits.perTransaction) {
      throw new Error('Daily limit cannot be less than per-transaction limit');
    }
  }

  /**
   * Check if card should be synced with issuer
   * @param {Object} card - Card object
   * @returns {boolean} Whether sync is needed
   */
  shouldSyncCard(card) {
    const syncInterval = 5 * 60 * 1000; // 5 minutes
    const lastSync = card.lastSyncedAt || card.createdAt;
    return (Date.now() - lastSync.getTime()) > syncInterval;
  }

  /**
   * Sync card status with issuer
   * @param {Object} card - Card object
   */
  async syncCardWithIssuer(card) {
    try {
      const adapter = this.getAdapter(card.issuerProvider);
      const issuerCard = await adapter.getCardDetails(card.issuerCardId);

      // Update local card if status differs
      if (issuerCard.status !== card.status) {
        card.updateStatus(issuerCard.status, 'Synced from issuer');
        await card.save();
        
        this.logger.info('Card status synced', {
          cardId: card._id,
          oldStatus: card.status,
          newStatus: issuerCard.status
        });
      }

    } catch (error) {
      this.logger.warn('Card sync failed', { cardId: card._id, error: error.message });
      // Don't throw error - sync failures shouldn't break main operations
    }
  }

  /**
   * Process webhook event from card issuer
   * @param {Object} event - Webhook event data
   * @returns {Promise<Object>} Processing result
   */
  async processWebhookEvent(event) {
    try {
      const adapter = this.getAdapter();
      const result = await adapter.processWebhookEvent(event);

      // Handle different event types
      if (result.transaction) {
        await this.handleTransactionEvent(result.transaction);
      }

      if (result.cardStatus) {
        await this.handleCardStatusEvent(result.cardStatus);
      }

      this.logger.info('Webhook event processed', { type: event.type, processed: result.processed });

      return result;

    } catch (error) {
      this.logger.error('Webhook processing failed', { event: event.type, error: error.message });
      throw error;
    }
  }

  /**
   * Handle transaction webhook event
   * @param {Object} transaction - Transaction data
   */
  async handleTransactionEvent(transaction) {
    const card = await VirtualCard.findOne({
      issuerCardId: transaction.cardId
    });

    if (card) {
      // Update card balance if needed
      // This would integrate with your Transaction model
      this.logger.info('Transaction event handled', {
        cardId: card._id,
        transactionId: transaction.transactionId,
        amount: transaction.amount
      });
    }
  }

  /**
   * Handle card status webhook event
   * @param {Object} cardStatus - Card status data
   */
  async handleCardStatusEvent(cardStatus) {
    const card = await VirtualCard.findOne({
      issuerCardId: cardStatus.cardId
    });

    if (card && card.status !== cardStatus.newStatus) {
      card.updateStatus(cardStatus.newStatus, 'Updated via webhook');
      await card.save();

      this.logger.info('Card status updated via webhook', {
        cardId: card._id,
        oldStatus: cardStatus.oldStatus,
        newStatus: cardStatus.newStatus
      });
    }
  }
}

module.exports = new ProductionCardService();