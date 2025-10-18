const VirtualCard = require('../models/VirtualCard');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

/**
 * Fraud Detection Service
 * Provides fraud detection and prevention capabilities for card transactions
 */
class FraudDetectionService {
  constructor() {
    this.logger = require('../utils/logger');
    
    // Fraud detection rules configuration
    this.rules = {
      velocityLimits: {
        transactionsPerMinute: 5,
        transactionsPerHour: 20,
        transactionsPerDay: 100
      },
      amountLimits: {
        unusualAmountMultiplier: 5, // 5x average transaction
        maxSingleTransaction: 5000
      },
      locationRules: {
        enableLocationChecking: false, // Would require IP geolocation
        maxDistanceKm: 1000
      },
      merchantRules: {
        highRiskCategories: ['gambling', 'adult', 'cryptocurrency'],
        blockedMerchants: []
      }
    };

    // Fraud score thresholds
    this.thresholds = {
      low: 30,      // Monitor
      medium: 60,   // Review
      high: 80,     // Block
      critical: 95  // Immediate freeze
    };
  }

  /**
   * Analyze transaction for fraud indicators
   * @param {Object} card - Virtual card object
   * @param {Object} transaction - Transaction data
   * @returns {Promise<Object>} Fraud analysis result
   */
  async analyzeTransaction(card, transaction) {
    try {
      this.logger.info('Analyzing transaction for fraud', {
        cardId: card._id,
        transactionId: transaction.transactionId,
        amount: transaction.amount
      });

      const analysis = {
        fraudScore: 0,
        riskLevel: 'low',
        indicators: [],
        recommendations: [],
        shouldBlock: false,
        shouldFreeze: false
      };

      // Run fraud detection rules
      await this.checkVelocityRules(card, transaction, analysis);
      await this.checkAmountRules(card, transaction, analysis);
      await this.checkMerchantRules(card, transaction, analysis);
      await this.checkPatternRules(card, transaction, analysis);
      await this.checkUserBehaviorRules(card, transaction, analysis);

      // Determine risk level based on fraud score
      analysis.riskLevel = this.calculateRiskLevel(analysis.fraudScore);
      
      // Determine actions based on risk level
      if (analysis.fraudScore >= this.thresholds.critical) {
        analysis.shouldFreeze = true;
        analysis.shouldBlock = true;
        analysis.recommendations.push('Immediately freeze card and block transaction');
      } else if (analysis.fraudScore >= this.thresholds.high) {
        analysis.shouldBlock = true;
        analysis.recommendations.push('Block transaction and require manual review');
      } else if (analysis.fraudScore >= this.thresholds.medium) {
        analysis.recommendations.push('Flag for manual review');
      } else if (analysis.fraudScore >= this.thresholds.low) {
        analysis.recommendations.push('Monitor closely');
      }

      this.logger.info('Fraud analysis completed', {
        cardId: card._id,
        fraudScore: analysis.fraudScore,
        riskLevel: analysis.riskLevel,
        indicatorCount: analysis.indicators.length
      });

      return analysis;

    } catch (error) {
      this.logger.error('Fraud analysis failed', {
        cardId: card._id,
        error: error.message
      });
      
      // Return safe default - block transaction if analysis fails
      return {
        fraudScore: 100,
        riskLevel: 'critical',
        indicators: ['analysis_failed'],
        recommendations: ['Block transaction due to analysis failure'],
        shouldBlock: true,
        shouldFreeze: false,
        error: error.message
      };
    }
  }

  /**
   * Check velocity-based fraud rules
   * @param {Object} card - Virtual card object
   * @param {Object} transaction - Transaction data
   * @param {Object} analysis - Analysis object to update
   */
  async checkVelocityRules(card, transaction, analysis) {
    try {
      const now = new Date();
      
      // Check transactions in last minute
      const lastMinute = new Date(now.getTime() - 60 * 1000);
      const recentTransactions = await Transaction.find({
        cardId: card._id,
        createdAt: { $gte: lastMinute },
        status: { $in: ['completed', 'pending'] }
      });

      if (recentTransactions.length >= this.rules.velocityLimits.transactionsPerMinute) {
        analysis.fraudScore += 40;
        analysis.indicators.push('high_velocity_minute');
        this.logger.warn('High velocity detected (per minute)', {
          cardId: card._id,
          transactionCount: recentTransactions.length
        });
      }

      // Check transactions in last hour
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
      const hourlyTransactions = await Transaction.find({
        cardId: card._id,
        createdAt: { $gte: lastHour },
        status: { $in: ['completed', 'pending'] }
      });

      if (hourlyTransactions.length >= this.rules.velocityLimits.transactionsPerHour) {
        analysis.fraudScore += 25;
        analysis.indicators.push('high_velocity_hour');
      }

      // Check for rapid successive transactions (within 30 seconds)
      if (recentTransactions.length > 0) {
        const lastTransaction = recentTransactions
          .sort((a, b) => b.createdAt - a.createdAt)[0];
        const timeDiff = now.getTime() - lastTransaction.createdAt.getTime();
        
        if (timeDiff < 30000) { // Less than 30 seconds
          analysis.fraudScore += 30;
          analysis.indicators.push('rapid_successive_transactions');
        }
      }

    } catch (error) {
      this.logger.error('Velocity rules check failed', {
        cardId: card._id,
        error: error.message
      });
    }
  }

  /**
   * Check amount-based fraud rules
   * @param {Object} card - Virtual card object
   * @param {Object} transaction - Transaction data
   * @param {Object} analysis - Analysis object to update
   */
  async checkAmountRules(card, transaction, analysis) {
    try {
      const amount = Math.abs(transaction.amount);

      // Check if amount exceeds maximum single transaction
      if (amount > this.rules.amountLimits.maxSingleTransaction) {
        analysis.fraudScore += 50;
        analysis.indicators.push('excessive_amount');
      }

      // Check against user's historical spending patterns
      const historicalTransactions = await Transaction.find({
        cardId: card._id,
        type: { $in: ['purchase', 'authorization'] },
        status: 'completed',
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      }).limit(50);

      if (historicalTransactions.length > 5) {
        const avgAmount = historicalTransactions.reduce((sum, tx) => sum + tx.amount, 0) / historicalTransactions.length;
        const maxAmount = Math.max(...historicalTransactions.map(tx => tx.amount));

        // Check if current transaction is unusually large
        if (amount > avgAmount * this.rules.amountLimits.unusualAmountMultiplier) {
          analysis.fraudScore += 35;
          analysis.indicators.push('unusual_amount_pattern');
        }

        // Check if amount is significantly higher than previous maximum
        if (amount > maxAmount * 2) {
          analysis.fraudScore += 25;
          analysis.indicators.push('amount_exceeds_history');
        }
      }

      // Check round number amounts (often used in fraud)
      if (amount % 100 === 0 && amount >= 500) {
        analysis.fraudScore += 10;
        analysis.indicators.push('round_amount');
      }

    } catch (error) {
      this.logger.error('Amount rules check failed', {
        cardId: card._id,
        error: error.message
      });
    }
  }

  /**
   * Check merchant-based fraud rules
   * @param {Object} card - Virtual card object
   * @param {Object} transaction - Transaction data
   * @param {Object} analysis - Analysis object to update
   */
  async checkMerchantRules(card, transaction, analysis) {
    try {
      const merchantName = transaction.merchantName || '';
      const merchantCategory = transaction.merchantCategory || '';

      // Check high-risk merchant categories
      if (this.rules.merchantRules.highRiskCategories.includes(merchantCategory.toLowerCase())) {
        analysis.fraudScore += 20;
        analysis.indicators.push('high_risk_merchant_category');
      }

      // Check blocked merchants
      if (this.rules.merchantRules.blockedMerchants.some(blocked => 
          merchantName.toLowerCase().includes(blocked.toLowerCase()))) {
        analysis.fraudScore += 60;
        analysis.indicators.push('blocked_merchant');
      }

      // Check for unusual merchant patterns
      const recentMerchants = await Transaction.find({
        cardId: card._id,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        'merchantInfo.name': { $exists: true, $ne: '' }
      }).distinct('merchantInfo.name');

      // If this is a completely new merchant and amount is high
      if (!recentMerchants.includes(merchantName) && transaction.amount > 1000) {
        analysis.fraudScore += 15;
        analysis.indicators.push('new_high_value_merchant');
      }

    } catch (error) {
      this.logger.error('Merchant rules check failed', {
        cardId: card._id,
        error: error.message
      });
    }
  }

  /**
   * Check pattern-based fraud rules
   * @param {Object} card - Virtual card object
   * @param {Object} transaction - Transaction data
   * @param {Object} analysis - Analysis object to update
   */
  async checkPatternRules(card, transaction, analysis) {
    try {
      // Check for testing patterns (small amounts followed by large amounts)
      const recentSmallTransactions = await Transaction.find({
        cardId: card._id,
        amount: { $lt: 10 },
        createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
        status: 'completed'
      });

      if (recentSmallTransactions.length >= 3 && transaction.amount > 500) {
        analysis.fraudScore += 45;
        analysis.indicators.push('testing_pattern');
      }

      // Check for duplicate amounts in short time period
      const duplicateAmounts = await Transaction.find({
        cardId: card._id,
        amount: transaction.amount,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
        status: { $in: ['completed', 'pending'] }
      });

      if (duplicateAmounts.length >= 3) {
        analysis.fraudScore += 20;
        analysis.indicators.push('duplicate_amounts');
      }

      // Check for unusual time patterns (transactions at unusual hours)
      const hour = new Date().getHours();
      if (hour >= 2 && hour <= 5) { // 2 AM to 5 AM
        analysis.fraudScore += 10;
        analysis.indicators.push('unusual_time');
      }

    } catch (error) {
      this.logger.error('Pattern rules check failed', {
        cardId: card._id,
        error: error.message
      });
    }
  }

  /**
   * Check user behavior-based fraud rules
   * @param {Object} card - Virtual card object
   * @param {Object} transaction - Transaction data
   * @param {Object} analysis - Analysis object to update
   */
  async checkUserBehaviorRules(card, transaction, analysis) {
    try {
      // Check if card was recently created (new card fraud)
      const cardAge = Date.now() - card.createdAt.getTime();
      const cardAgeHours = cardAge / (1000 * 60 * 60);

      if (cardAgeHours < 24 && transaction.amount > 1000) {
        analysis.fraudScore += 30;
        analysis.indicators.push('new_card_high_value');
      }

      // Check user's overall transaction history
      const user = await User.findById(card.userId);
      if (user) {
        const userAge = Date.now() - user.createdAt.getTime();
        const userAgeDays = userAge / (1000 * 60 * 60 * 24);

        // New user with high-value transaction
        if (userAgeDays < 7 && transaction.amount > 2000) {
          analysis.fraudScore += 25;
          analysis.indicators.push('new_user_high_value');
        }

        // Check if user has had previous fraud flags
        const userCards = await VirtualCard.find({ userId: user._id });
        const hasFraudFlags = userCards.some(c => 
          c.complianceFlags && c.complianceFlags.includes('fraud_alert')
        );

        if (hasFraudFlags) {
          analysis.fraudScore += 20;
          analysis.indicators.push('previous_fraud_history');
        }
      }

    } catch (error) {
      this.logger.error('User behavior rules check failed', {
        cardId: card._id,
        error: error.message
      });
    }
  }

  /**
   * Calculate risk level based on fraud score
   * @param {number} fraudScore - Calculated fraud score
   * @returns {string} Risk level
   */
  calculateRiskLevel(fraudScore) {
    if (fraudScore >= this.thresholds.critical) return 'critical';
    if (fraudScore >= this.thresholds.high) return 'high';
    if (fraudScore >= this.thresholds.medium) return 'medium';
    if (fraudScore >= this.thresholds.low) return 'low';
    return 'minimal';
  }

  /**
   * Execute fraud prevention actions
   * @param {Object} card - Virtual card object
   * @param {Object} analysis - Fraud analysis result
   * @returns {Promise<Object>} Action result
   */
  async executeFraudPrevention(card, analysis) {
    try {
      const actions = [];

      // Add compliance flags
      if (analysis.fraudScore >= this.thresholds.medium) {
        card.addComplianceFlag('fraud_alert');
        actions.push('added_fraud_flag');
      }

      if (analysis.fraudScore >= this.thresholds.high) {
        card.addComplianceFlag('high_risk');
        actions.push('added_high_risk_flag');
      }

      // Freeze card if critical risk
      if (analysis.shouldFreeze) {
        card.updateStatus('frozen', 'Automatically frozen due to fraud detection');
        actions.push('card_frozen');
        
        // TODO: Send immediate notification to user
        this.logger.warn('Card automatically frozen due to fraud', {
          cardId: card._id,
          fraudScore: analysis.fraudScore
        });
      }

      // Save card changes
      if (actions.length > 0) {
        await card.save();
      }

      // Log fraud event
      this.logger.info('Fraud prevention actions executed', {
        cardId: card._id,
        fraudScore: analysis.fraudScore,
        riskLevel: analysis.riskLevel,
        actions
      });

      return {
        success: true,
        actions,
        cardFrozen: analysis.shouldFreeze,
        transactionBlocked: analysis.shouldBlock
      };

    } catch (error) {
      this.logger.error('Fraud prevention execution failed', {
        cardId: card._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get fraud detection statistics
   * @param {string} cardId - Card ID (optional)
   * @returns {Promise<Object>} Fraud statistics
   */
  async getFraudStats(cardId = null) {
    try {
      const query = cardId ? { cardId } : {};
      
      // This would be more comprehensive in a real implementation
      const stats = {
        totalTransactionsAnalyzed: 0,
        fraudDetected: 0,
        cardsBlocked: 0,
        averageFraudScore: 0,
        topFraudIndicators: []
      };

      return stats;

    } catch (error) {
      this.logger.error('Get fraud stats failed', { error: error.message });
      return null;
    }
  }

  /**
   * Update fraud detection rules (for admin use)
   * @param {Object} newRules - New rule configuration
   * @returns {Object} Update result
   */
  updateRules(newRules) {
    try {
      this.rules = { ...this.rules, ...newRules };
      
      this.logger.info('Fraud detection rules updated', {
        updatedAt: new Date(),
        rules: this.rules
      });

      return {
        success: true,
        message: 'Fraud detection rules updated',
        rules: this.rules
      };

    } catch (error) {
      this.logger.error('Rule update failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test fraud detection with sample data
   * @param {Object} testData - Test transaction data
   * @returns {Promise<Object>} Test result
   */
  async testFraudDetection(testData) {
    try {
      // This would be used for testing fraud detection rules
      const mockCard = {
        _id: 'test-card-id',
        userId: 'test-user-id',
        createdAt: new Date(),
        spendingLimits: { daily: 1000, monthly: 5000 },
        complianceFlags: []
      };

      const analysis = await this.analyzeTransaction(mockCard, testData);
      
      return {
        success: true,
        testData,
        analysis,
        message: 'Fraud detection test completed'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new FraudDetectionService();