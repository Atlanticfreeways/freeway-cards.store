const VirtualCard = require('../models/VirtualCard');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

/**
 * Balance Update Service
 * Handles real-time balance updates and spending limit enforcement
 */
class BalanceUpdateService {
  constructor() {
    this.logger = require('../utils/logger');
  }

  /**
   * Process transaction and update balances
   * @param {Object} transactionData - Transaction data from webhook
   * @returns {Promise<Object>} Processing result
   */
  async processTransactionUpdate(transactionData) {
    try {
      const {
        cardId,
        issuerTransactionId,
        amount,
        type,
        status,
        merchantInfo = {}
      } = transactionData;

      // Find the card
      const card = await VirtualCard.findOne({ issuerCardId: cardId });
      if (!card) {
        throw new Error(`Card not found: ${cardId}`);
      }

      // Check if transaction already exists
      let transaction = await Transaction.findOne({ issuerTransactionId });
      
      if (transaction) {
        // Update existing transaction
        return await this.updateExistingTransaction(transaction, transactionData);
      } else {
        // Create new transaction
        return await this.createNewTransaction(card, transactionData);
      }

    } catch (error) {
      this.logger.error('Transaction processing failed', {
        issuerTransactionId: transactionData.issuerTransactionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create new transaction record
   * @param {Object} card - Virtual card object
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  async createNewTransaction(card, transactionData) {
    const {
      issuerTransactionId,
      amount,
      type,
      status,
      merchantInfo = {},
      authorizationCode,
      currency = 'USD'
    } = transactionData;

    // Check spending limits before processing
    const limitCheck = await this.checkSpendingLimits(card, amount, type);
    if (!limitCheck.allowed) {
      this.logger.warn('Transaction blocked by spending limits', {
        cardId: card._id,
        amount,
        reason: limitCheck.reason
      });
      
      // Still create transaction record but mark as declined
      const blockedTransaction = new Transaction({
        userId: card.userId,
        cardId: card._id,
        issuerTransactionId,
        issuerEventType: type,
        type: this.mapTransactionType(type),
        amount: Math.abs(amount),
        currency,
        description: `DECLINED: ${merchantInfo.name || 'Transaction'} - ${limitCheck.reason}`,
        status: 'failed',
        processingStatus: 'declined',
        merchantInfo,
        authorizationCode,
        balanceBefore: card.balance,
        balanceAfter: card.balance, // No change
        metadata: {
          declineReason: limitCheck.reason,
          limitType: limitCheck.limitType
        }
      });

      await blockedTransaction.save();
      return {
        transaction: blockedTransaction,
        balanceUpdated: false,
        declined: true,
        reason: limitCheck.reason
      };
    }

    // Calculate balance changes
    const balanceBefore = card.balance;
    let balanceChange = 0;

    // Determine balance impact based on transaction type
    if (type === 'authorization') {
      // For authorizations, we might hold the amount but not immediately deduct
      balanceChange = 0; // Don't change balance until settlement
    } else if (type === 'clearing' || type === 'settlement') {
      // For settlements, deduct the amount
      balanceChange = -Math.abs(amount);
    } else if (type === 'reversal' || type === 'refund') {
      // For reversals, add the amount back
      balanceChange = Math.abs(amount);
    }

    const balanceAfter = Math.max(0, balanceBefore + balanceChange);

    // Create transaction record
    const transaction = new Transaction({
      userId: card.userId,
      cardId: card._id,
      issuerTransactionId,
      issuerEventType: type,
      type: this.mapTransactionType(type),
      amount: Math.abs(amount),
      currency,
      description: this.generateTransactionDescription(merchantInfo, amount, currency),
      status: this.mapTransactionStatus(status),
      processingStatus: status,
      merchantInfo,
      authorizationCode,
      balanceBefore,
      balanceAfter,
      metadata: {
        balanceChange,
        processedAt: new Date(),
        provider: card.issuerProvider
      }
    });

    await transaction.save();

    // Update card balance if needed
    let balanceUpdated = false;
    if (balanceChange !== 0) {
      card.balance = balanceAfter;
      card.lastSyncedAt = new Date();
      await card.save();
      balanceUpdated = true;

      this.logger.info('Card balance updated', {
        cardId: card._id,
        balanceBefore,
        balanceAfter,
        balanceChange,
        transactionId: transaction._id
      });
    }

    // Update user wallet balance if this affects available funds
    await this.updateUserWalletBalance(card.userId, balanceChange);

    return {
      transaction,
      balanceUpdated,
      balanceBefore,
      balanceAfter,
      balanceChange
    };
  }

  /**
   * Update existing transaction record
   * @param {Object} transaction - Existing transaction
   * @param {Object} transactionData - Updated transaction data
   * @returns {Promise<Object>} Updated transaction
   */
  async updateExistingTransaction(transaction, transactionData) {
    const { status, type, amount } = transactionData;
    
    const oldStatus = transaction.status;
    const oldProcessingStatus = transaction.processingStatus;

    // Update transaction status
    transaction.updateStatus(this.mapTransactionStatus(status), status);
    
    // If this is a status change that affects balance, handle it
    let balanceChange = 0;
    let balanceUpdated = false;

    // Handle authorization -> settlement transitions
    if (oldProcessingStatus === 'approved' && status === 'settled' && type === 'clearing') {
      // Now actually deduct the amount from balance
      const card = await VirtualCard.findById(transaction.cardId);
      if (card) {
        balanceChange = -Math.abs(amount);
        const newBalance = Math.max(0, card.balance + balanceChange);
        
        transaction.balanceAfter = newBalance;
        card.balance = newBalance;
        await card.save();
        balanceUpdated = true;

        this.logger.info('Balance updated on settlement', {
          cardId: card._id,
          transactionId: transaction._id,
          balanceChange,
          newBalance
        });
      }
    }

    await transaction.save();

    return {
      transaction,
      balanceUpdated,
      statusChanged: oldStatus !== transaction.status,
      balanceChange
    };
  }

  /**
   * Check spending limits before processing transaction
   * @param {Object} card - Virtual card object
   * @param {number} amount - Transaction amount
   * @param {string} type - Transaction type
   * @returns {Promise<Object>} Limit check result
   */
  async checkSpendingLimits(card, amount, type) {
    try {
      // Only check limits for spending transactions
      if (!['authorization', 'purchase'].includes(type)) {
        return { allowed: true };
      }

      const transactionAmount = Math.abs(amount);

      // Check per-transaction limit
      if (transactionAmount > card.spendingLimits.perTransaction) {
        return {
          allowed: false,
          reason: `Transaction amount (${transactionAmount}) exceeds per-transaction limit (${card.spendingLimits.perTransaction})`,
          limitType: 'per_transaction'
        };
      }

      // Check daily spending limit
      const dailySpending = await this.getDailySpending(card._id);
      if (dailySpending + transactionAmount > card.spendingLimits.daily) {
        return {
          allowed: false,
          reason: `Daily spending limit exceeded. Current: ${dailySpending}, Limit: ${card.spendingLimits.daily}`,
          limitType: 'daily'
        };
      }

      // Check monthly spending limit
      const monthlySpending = await this.getMonthlySpending(card._id);
      if (monthlySpending + transactionAmount > card.spendingLimits.monthly) {
        return {
          allowed: false,
          reason: `Monthly spending limit exceeded. Current: ${monthlySpending}, Limit: ${card.spendingLimits.monthly}`,
          limitType: 'monthly'
        };
      }

      // Check available balance
      if (transactionAmount > card.balance) {
        return {
          allowed: false,
          reason: `Insufficient balance. Available: ${card.balance}, Required: ${transactionAmount}`,
          limitType: 'balance'
        };
      }

      return { allowed: true };

    } catch (error) {
      this.logger.error('Spending limit check failed', {
        cardId: card._id,
        amount,
        error: error.message
      });
      
      // Fail safe - deny transaction if we can't check limits
      return {
        allowed: false,
        reason: 'Unable to verify spending limits',
        limitType: 'system_error'
      };
    }
  }

  /**
   * Get daily spending for a card
   * @param {string} cardId - Card ID
   * @returns {Promise<number>} Daily spending amount
   */
  async getDailySpending(cardId) {
    const result = await Transaction.getDailySpending(cardId);
    return result.length > 0 ? result[0].totalSpent : 0;
  }

  /**
   * Get monthly spending for a card
   * @param {string} cardId - Card ID
   * @returns {Promise<number>} Monthly spending amount
   */
  async getMonthlySpending(cardId) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await Transaction.aggregate([
      {
        $match: {
          cardId: cardId,
          createdAt: { $gte: startOfMonth },
          type: { $in: ['authorization', 'purchase', 'card_purchase'] },
          status: { $in: ['completed', 'pending'] }
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' }
        }
      }
    ]);

    return result.length > 0 ? result[0].totalSpent : 0;
  }

  /**
   * Update user wallet balance
   * @param {string} userId - User ID
   * @param {number} balanceChange - Balance change amount
   */
  async updateUserWalletBalance(userId, balanceChange) {
    try {
      if (balanceChange !== 0) {
        await User.findByIdAndUpdate(userId, {
          $inc: { walletBalance: balanceChange }
        });

        this.logger.info('User wallet balance updated', {
          userId,
          balanceChange
        });
      }
    } catch (error) {
      this.logger.error('User wallet balance update failed', {
        userId,
        balanceChange,
        error: error.message
      });
      // Don't throw error - card balance update is more critical
    }
  }

  /**
   * Map transaction type from issuer to internal type
   * @param {string} issuerType - Issuer transaction type
   * @returns {string} Internal transaction type
   */
  mapTransactionType(issuerType) {
    const typeMap = {
      'authorization': 'authorization',
      'clearing': 'purchase',
      'settlement': 'purchase',
      'reversal': 'reversal',
      'chargeback': 'chargeback',
      'refund': 'refund'
    };

    return typeMap[issuerType] || 'unknown';
  }

  /**
   * Map transaction status from issuer to internal status
   * @param {string} issuerStatus - Issuer transaction status
   * @returns {string} Internal transaction status
   */
  mapTransactionStatus(issuerStatus) {
    const statusMap = {
      'approved': 'completed',
      'declined': 'failed',
      'settled': 'completed',
      'pending': 'pending',
      'reversed': 'cancelled'
    };

    return statusMap[issuerStatus] || 'pending';
  }

  /**
   * Generate transaction description
   * @param {Object} merchantInfo - Merchant information
   * @param {number} amount - Transaction amount
   * @param {string} currency - Currency code
   * @returns {string} Transaction description
   */
  generateTransactionDescription(merchantInfo, amount, currency = 'USD') {
    const merchantName = merchantInfo.name || 'Unknown Merchant';
    const formattedAmount = `${currency} ${Math.abs(amount).toFixed(2)}`;
    
    if (merchantInfo.location) {
      return `${merchantName} - ${merchantInfo.location} - ${formattedAmount}`;
    }
    
    return `${merchantName} - ${formattedAmount}`;
  }

  /**
   * Get balance update statistics
   * @returns {Object} Balance update statistics
   */
  getStats() {
    return {
      // This would be populated with actual statistics in a real implementation
      totalTransactionsProcessed: 0,
      totalBalanceUpdates: 0,
      averageProcessingTime: 0,
      lastProcessedAt: null
    };
  }
}

module.exports = new BalanceUpdateService();