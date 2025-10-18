const VirtualCard = require('../models/VirtualCard');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const cardIssuerConfig = require('../config/cardIssuer');
const balanceUpdateService = require('./balanceUpdateService');

/**
 * Webhook Processor Service
 * Handles real-time webhook events from card issuer providers
 */
class WebhookProcessor {
  constructor() {
    this.logger = require('../utils/logger');
    this.processedEvents = new Set(); // Simple in-memory deduplication
    
    // Event processing statistics
    this.stats = {
      processed: 0,
      failed: 0,
      duplicates: 0,
      lastProcessed: null
    };
  }

  /**
   * Process incoming webhook event
   * @param {string} provider - Card issuer provider (marqeta, stripe)
   * @param {Object} event - Webhook event data
   * @param {string} signature - Webhook signature for validation
   * @returns {Promise<Object>} Processing result
   */
  async processWebhookEvent(provider, event, signature) {
    const startTime = Date.now();
    
    try {
      this.logger.info('Processing webhook event', {
        provider,
        eventType: event.type,
        eventId: event.id || event.token,
        timestamp: new Date().toISOString()
      });

      // Validate webhook signature
      if (!this.validateWebhookSignature(provider, event, signature)) {
        throw new Error('Invalid webhook signature');
      }

      // Check for duplicate events (idempotency)
      const eventKey = this.generateEventKey(provider, event);
      if (this.processedEvents.has(eventKey)) {
        this.stats.duplicates++;
        this.logger.warn('Duplicate webhook event ignored', { eventKey });
        return {
          success: true,
          duplicate: true,
          eventKey,
          processingTime: Date.now() - startTime
        };
      }

      // Get appropriate adapter for processing
      const adapter = cardIssuerConfig.getAdapter(provider);
      const result = await adapter.processWebhookEvent(event);

      // Process different event types
      const processingResult = await this.handleEventByType(provider, event, result);

      // Mark event as processed
      this.processedEvents.add(eventKey);
      this.stats.processed++;
      this.stats.lastProcessed = new Date();

      // Clean up old processed events (keep last 1000)
      if (this.processedEvents.size > 1000) {
        const eventsArray = Array.from(this.processedEvents);
        this.processedEvents.clear();
        eventsArray.slice(-500).forEach(key => this.processedEvents.add(key));
      }

      this.logger.info('Webhook event processed successfully', {
        provider,
        eventType: event.type,
        processingTime: Date.now() - startTime,
        result: processingResult.type
      });

      return {
        success: true,
        provider,
        eventType: event.type,
        result: processingResult,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      this.stats.failed++;
      this.logger.error('Webhook processing failed', {
        provider,
        eventType: event.type,
        error: error.message,
        processingTime: Date.now() - startTime
      });

      throw new Error(`Webhook processing failed: ${error.message}`);
    }
  }

  /**
   * Handle different types of webhook events
   * @param {string} provider - Card issuer provider
   * @param {Object} event - Original webhook event
   * @param {Object} result - Processed result from adapter
   * @returns {Promise<Object>} Handling result
   */
  async handleEventByType(provider, event, result) {
    switch (result.type) {
      case 'transaction.authorization':
      case 'transaction.clearing':
      case 'issuing_authorization.created':
      case 'issuing_transaction.created':
        return await this.handleTransactionEvent(result.transaction || result.authorization);

      case 'card.transition':
      case 'issuing_card.updated':
        return await this.handleCardStatusEvent(result.cardStatus || result.card);

      case 'transaction.reversal':
      case 'transaction.chargeback':
        return await this.handleTransactionReversal(result.transaction);

      default:
        this.logger.warn('Unknown webhook event type', { 
          provider, 
          type: result.type 
        });
        return {
          type: 'unknown',
          processed: false,
          message: `Unknown event type: ${result.type}`
        };
    }
  }

  /**
   * Handle transaction authorization/clearing events
   * @param {Object} transaction - Transaction data
   * @returns {Promise<Object>} Handling result
   */
  async handleTransactionEvent(transaction) {
    try {
      this.logger.info('Processing transaction event', {
        transactionId: transaction.transactionId,
        cardId: transaction.cardId,
        amount: transaction.amount,
        type: transaction.type
      });

      // Use the balance update service to handle the transaction
      const result = await balanceUpdateService.processTransactionUpdate({
        cardId: transaction.cardId,
        issuerTransactionId: transaction.transactionId,
        amount: transaction.amount,
        type: transaction.type,
        status: transaction.status,
        currency: transaction.currency || 'USD',
        merchantInfo: {
          name: transaction.merchantName || 'Unknown Merchant',
          category: transaction.merchantCategory || 'Unknown',
          location: transaction.merchantLocation || '',
          mcc: transaction.merchantMcc || ''
        },
        authorizationCode: transaction.authorizationCode
      });

      // Check for potential fraud or unusual activity if transaction was processed
      if (result.transaction && !result.declined) {
        const card = await VirtualCard.findById(result.transaction.cardId);
        if (card) {
          await this.checkForFraudIndicators(card, transaction);
        }
      }

      this.logger.info('Transaction event processed', {
        transactionId: transaction.transactionId,
        processed: true,
        balanceUpdated: result.balanceUpdated,
        declined: result.declined || false
      });

      return {
        type: 'transaction',
        processed: true,
        transactionId: result.transaction._id,
        cardId: result.transaction.cardId,
        amount: transaction.amount,
        status: transaction.status,
        balanceUpdated: result.balanceUpdated,
        declined: result.declined || false,
        balanceChange: result.balanceChange || 0
      };

    } catch (error) {
      this.logger.error('Transaction event handling failed', {
        transactionId: transaction.transactionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle card status change events
   * @param {Object} cardStatus - Card status data
   * @returns {Promise<Object>} Handling result
   */
  async handleCardStatusEvent(cardStatus) {
    try {
      const card = await VirtualCard.findOne({
        issuerCardId: cardStatus.cardId
      });

      if (!card) {
        this.logger.warn('Card not found for status update', {
          issuerCardId: cardStatus.cardId
        });
        return {
          type: 'card_status',
          processed: false,
          message: 'Card not found'
        };
      }

      const oldStatus = card.status;
      const newStatus = cardStatus.newStatus || cardStatus.status;

      if (oldStatus !== newStatus) {
        card.updateStatus(newStatus, 'Updated via webhook');
        await card.save();

        this.logger.info('Card status updated via webhook', {
          cardId: card._id,
          oldStatus,
          newStatus,
          timestamp: cardStatus.timestamp
        });

        // Notify user of status change if significant
        if (this.isSignificantStatusChange(oldStatus, newStatus)) {
          await this.notifyUserOfStatusChange(card, oldStatus, newStatus);
        }
      }

      return {
        type: 'card_status',
        processed: true,
        cardId: card._id,
        oldStatus,
        newStatus,
        changed: oldStatus !== newStatus
      };

    } catch (error) {
      this.logger.error('Card status event handling failed', {
        cardId: cardStatus.cardId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle transaction reversal/chargeback events
   * @param {Object} transaction - Transaction reversal data
   * @returns {Promise<Object>} Handling result
   */
  async handleTransactionReversal(transaction) {
    try {
      // Find original transaction
      const originalTransaction = await Transaction.findOne({
        issuerTransactionId: transaction.originalTransactionId || transaction.transactionId
      });

      if (!originalTransaction) {
        this.logger.warn('Original transaction not found for reversal', {
          transactionId: transaction.transactionId
        });
        return {
          type: 'reversal',
          processed: false,
          message: 'Original transaction not found'
        };
      }

      // Create reversal transaction record
      const reversalTransaction = new Transaction({
        userId: originalTransaction.userId,
        cardId: originalTransaction.cardId,
        issuerTransactionId: transaction.transactionId,
        issuerEventType: 'reversal',
        type: 'reversal',
        amount: transaction.amount,
        currency: transaction.currency || 'USD',
        description: `Reversal: ${originalTransaction.description}`,
        status: 'completed',
        processingStatus: 'settled',
        relatedTransactionId: originalTransaction._id,
        metadata: {
          originalTransactionId: originalTransaction.issuerTransactionId,
          reversalReason: transaction.reason || 'Unknown'
        }
      });

      await reversalTransaction.save();

      // Update card balance (credit back the amount)
      const card = await VirtualCard.findById(originalTransaction.cardId);
      if (card) {
        card.balance += Math.abs(transaction.amount);
        await card.save();

        this.logger.info('Transaction reversed, balance credited', {
          cardId: card._id,
          amount: transaction.amount,
          newBalance: card.balance,
          originalTransactionId: originalTransaction.issuerTransactionId
        });
      }

      return {
        type: 'reversal',
        processed: true,
        reversalTransactionId: reversalTransaction._id,
        originalTransactionId: originalTransaction._id,
        amount: transaction.amount
      };

    } catch (error) {
      this.logger.error('Transaction reversal handling failed', {
        transactionId: transaction.transactionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate webhook signature
   * @param {string} provider - Card issuer provider
   * @param {Object} event - Webhook event
   * @param {string} signature - Webhook signature
   * @returns {boolean} Validation result
   */
  validateWebhookSignature(provider, event, signature) {
    try {
      if (!cardIssuerConfig.featureFlags.enableWebhooks) {
        // Skip validation if webhooks are disabled
        return true;
      }

      const webhookConfig = cardIssuerConfig.getWebhookConfig(provider);
      if (!webhookConfig.enabled || !webhookConfig.secret) {
        this.logger.warn('Webhook validation skipped - no secret configured', { provider });
        return true;
      }

      const adapter = cardIssuerConfig.getAdapter(provider);
      const payload = JSON.stringify(event);
      
      return adapter.validateWebhookSignature(payload, signature, webhookConfig.secret);

    } catch (error) {
      this.logger.error('Webhook signature validation failed', {
        provider,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Generate unique event key for deduplication
   * @param {string} provider - Card issuer provider
   * @param {Object} event - Webhook event
   * @returns {string} Unique event key
   */
  generateEventKey(provider, event) {
    const eventId = event.id || event.token || event.transaction_id;
    const eventType = event.type;
    const timestamp = event.created_time || event.created || Date.now();
    
    return `${provider}:${eventType}:${eventId}:${timestamp}`;
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
   * Generate transaction description
   * @param {Object} transaction - Transaction data
   * @returns {string} Transaction description
   */
  generateTransactionDescription(transaction) {
    const merchantName = transaction.merchantName || 'Unknown Merchant';
    const amount = Math.abs(transaction.amount);
    const currency = transaction.currency || 'USD';
    
    return `${merchantName} - ${currency} ${amount.toFixed(2)}`;
  }

  /**
   * Check for fraud indicators using fraud detection service
   * @param {Object} card - Card object
   * @param {Object} transaction - Transaction data
   */
  async checkForFraudIndicators(card, transaction) {
    try {
      // Import fraud detection service
      const fraudDetectionService = require('./fraudDetectionService');

      // Analyze transaction for fraud
      const analysis = await fraudDetectionService.analyzeTransaction(card, transaction);

      // Execute fraud prevention actions if needed
      if (analysis.fraudScore >= 30) { // Low threshold
        const preventionResult = await fraudDetectionService.executeFraudPrevention(card, analysis);
        
        this.logger.info('Fraud prevention executed', {
          cardId: card._id,
          transactionId: transaction.transactionId,
          fraudScore: analysis.fraudScore,
          riskLevel: analysis.riskLevel,
          actions: preventionResult.actions
        });

        // Return fraud analysis for further processing
        return {
          fraudDetected: analysis.fraudScore >= 60,
          fraudScore: analysis.fraudScore,
          riskLevel: analysis.riskLevel,
          indicators: analysis.indicators,
          actions: preventionResult.actions,
          cardFrozen: preventionResult.cardFrozen,
          transactionBlocked: preventionResult.transactionBlocked
        };
      }

      return {
        fraudDetected: false,
        fraudScore: analysis.fraudScore,
        riskLevel: analysis.riskLevel
      };

    } catch (error) {
      this.logger.error('Fraud detection failed', {
        cardId: card._id,
        transactionId: transaction.transactionId,
        error: error.message
      });

      // Return safe default
      return {
        fraudDetected: false,
        fraudScore: 0,
        riskLevel: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * Check if status change is significant enough to notify user
   * @param {string} oldStatus - Old card status
   * @param {string} newStatus - New card status
   * @returns {boolean} Whether change is significant
   */
  isSignificantStatusChange(oldStatus, newStatus) {
    const significantChanges = [
      ['active', 'frozen'],
      ['active', 'suspended'],
      ['frozen', 'active'],
      ['suspended', 'active']
    ];

    return significantChanges.some(([from, to]) => 
      oldStatus === from && newStatus === to
    );
  }

  /**
   * Notify user of significant card status changes
   * @param {Object} card - Card object
   * @param {string} oldStatus - Old status
   * @param {string} newStatus - New status
   */
  async notifyUserOfStatusChange(card, oldStatus, newStatus) {
    try {
      // This would integrate with your notification system
      // For now, just log the notification
      this.logger.info('User notification triggered', {
        userId: card.userId,
        cardId: card._id,
        statusChange: `${oldStatus} -> ${newStatus}`,
        notificationType: 'card_status_change'
      });

      // TODO: Integrate with email/SMS notification service
      // await notificationService.sendCardStatusNotification(card.userId, {
      //   cardName: card.cardName,
      //   oldStatus,
      //   newStatus,
      //   timestamp: new Date()
      // });

    } catch (error) {
      this.logger.error('User notification failed', {
        userId: card.userId,
        cardId: card._id,
        error: error.message
      });
    }
  }

  /**
   * Get webhook processing statistics
   * @returns {Object} Processing statistics
   */
  getStats() {
    return {
      ...this.stats,
      processedEventsCount: this.processedEvents.size,
      uptime: process.uptime()
    };
  }

  /**
   * Clear processed events cache (for testing)
   */
  clearProcessedEvents() {
    this.processedEvents.clear();
    this.stats = {
      processed: 0,
      failed: 0,
      duplicates: 0,
      lastProcessed: null
    };
  }
}

module.exports = new WebhookProcessor();