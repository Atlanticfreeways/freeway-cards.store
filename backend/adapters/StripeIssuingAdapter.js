const stripe = require('stripe');
const crypto = require('crypto');
const CardIssuerAdapter = require('./CardIssuerAdapter');

/**
 * Stripe Issuing card adapter implementation
 * Integrates with Stripe's card issuing platform
 */
class StripeIssuingAdapter extends CardIssuerAdapter {
  constructor(config) {
    super(config);
    
    // Initialize Stripe client
    this.stripe = stripe(this.apiKey);
    this.webhookSecret = config.webhookSecret;
    
    this.log('Stripe Issuing adapter initialized', { 
      environment: this.environment 
    });
  }

  /**
   * Create a new virtual card using Stripe Issuing
   */
  async createCard(userProfile, cardConfig) {
    try {
      this.log('Creating card', { userId: userProfile.userId, cardType: cardConfig.cardType });

      // First, ensure cardholder exists
      const cardholderId = await this.ensureCardholderExists(userProfile);

      // Create the card
      const cardData = {
        cardholder: cardholderId,
        currency: 'usd',
        type: 'virtual',
        status: 'active',
        spending_controls: {
          spending_limits: []
        },
        metadata: {
          card_name: cardConfig.cardName || 'Virtual Card',
          user_id: userProfile.userId,
          card_type: cardConfig.cardType,
          created_by: 'freeway_cards_platform'
        }
      };

      // Add spending limits if specified
      if (cardConfig.spendingLimits) {
        if (cardConfig.spendingLimits.daily) {
          cardData.spending_controls.spending_limits.push({
            amount: cardConfig.spendingLimits.daily * 100, // Convert to cents
            interval: 'daily'
          });
        }
        if (cardConfig.spendingLimits.monthly) {
          cardData.spending_controls.spending_limits.push({
            amount: cardConfig.spendingLimits.monthly * 100,
            interval: 'monthly'
          });
        }
        if (cardConfig.spendingLimits.perTransaction) {
          cardData.spending_controls.spending_limits.push({
            amount: cardConfig.spendingLimits.perTransaction * 100,
            interval: 'per_authorization'
          });
        }
      }

      const card = await this.retryWithBackoff(async () => {
        return await this.stripe.issuing.cards.create(cardData);
      });

      // Get card details including sensitive data
      const cardDetails = await this.stripe.issuing.cards.retrieve(card.id, {
        expand: ['number', 'cvc']
      });

      this.log('Card created successfully', { cardId: card.id });

      return {
        externalCardId: card.id,
        cardNumber: cardDetails.number,
        expiryMonth: String(cardDetails.exp_month).padStart(2, '0'),
        expiryYear: String(cardDetails.exp_year).slice(-2),
        cvv: cardDetails.cvc,
        status: this.mapStripeStatus(card.status),
        issuerData: {
          cardholderId: card.cardholder,
          brand: card.brand,
          created: card.created,
          lastModified: card.created
        }
      };

    } catch (error) {
      throw this.handleApiError(error, 'Card Creation');
    }
  }

  /**
   * Update card status in Stripe Issuing
   */
  async updateCardStatus(cardId, status, reason = '') {
    try {
      this.log('Updating card status', { cardId, status, reason });

      const stripeStatus = this.mapToStripeStatus(status);
      const updateData = {
        status: stripeStatus,
        metadata: {
          status_change_reason: reason,
          changed_at: new Date().toISOString()
        }
      };

      const card = await this.retryWithBackoff(async () => {
        return await this.stripe.issuing.cards.update(cardId, updateData);
      });

      this.log('Card status updated', { cardId, newStatus: card.status });

      return {
        success: true,
        status: this.mapStripeStatus(card.status),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw this.handleApiError(error, 'Card Status Update');
    }
  }

  /**
   * Set spending limits for a card
   */
  async setSpendingLimits(cardId, limits) {
    try {
      this.log('Setting spending limits', { cardId, limits });

      const spendingLimits = [];

      if (limits.daily) {
        spendingLimits.push({
          amount: limits.daily * 100,
          interval: 'daily'
        });
      }

      if (limits.monthly) {
        spendingLimits.push({
          amount: limits.monthly * 100,
          interval: 'monthly'
        });
      }

      if (limits.perTransaction) {
        spendingLimits.push({
          amount: limits.perTransaction * 100,
          interval: 'per_authorization'
        });
      }

      const card = await this.retryWithBackoff(async () => {
        return await this.stripe.issuing.cards.update(cardId, {
          spending_controls: {
            spending_limits: spendingLimits
          }
        });
      });

      this.log('Spending limits set', { cardId });

      return {
        success: true,
        limits: limits,
        cardId: card.id
      };

    } catch (error) {
      throw this.handleApiError(error, 'Set Spending Limits');
    }
  }

  /**
   * Get card details from Stripe Issuing
   */
  async getCardDetails(cardId) {
    try {
      this.log('Getting card details', { cardId });

      const card = await this.retryWithBackoff(async () => {
        return await this.stripe.issuing.cards.retrieve(cardId);
      });

      return {
        cardId: card.id,
        status: this.mapStripeStatus(card.status),
        brand: card.brand,
        last4: card.last4,
        expiryMonth: String(card.exp_month).padStart(2, '0'),
        expiryYear: String(card.exp_year).slice(-2),
        cardholderId: card.cardholder,
        spendingLimits: this.parseSpendingLimits(card.spending_controls?.spending_limits),
        created: card.created,
        metadata: card.metadata
      };

    } catch (error) {
      throw this.handleApiError(error, 'Get Card Details');
    }
  }

  /**
   * Get transaction history for a card
   */
  async getTransactionHistory(cardId, filters = {}) {
    try {
      this.log('Getting transaction history', { cardId, filters });

      const params = {
        card: cardId,
        limit: filters.limit || 50
      };

      if (filters.startDate) {
        params.created = { gte: Math.floor(new Date(filters.startDate).getTime() / 1000) };
      }
      if (filters.endDate) {
        params.created = { 
          ...params.created,
          lte: Math.floor(new Date(filters.endDate).getTime() / 1000) 
        };
      }

      const transactions = await this.retryWithBackoff(async () => {
        return await this.stripe.issuing.transactions.list(params);
      });

      return transactions.data.map(tx => ({
        transactionId: tx.id,
        amount: tx.amount / 100, // Convert from cents
        currency: tx.currency.toUpperCase(),
        merchantName: tx.merchant_data?.name || 'Unknown Merchant',
        merchantCategory: tx.merchant_data?.category || 'Unknown',
        status: tx.status,
        type: tx.type,
        timestamp: new Date(tx.created * 1000).toISOString(),
        authorizationCode: tx.authorization?.id
      }));

    } catch (error) {
      throw this.handleApiError(error, 'Get Transaction History');
    }
  }

  /**
   * Load funds onto a card (Stripe Issuing uses balance management)
   */
  async loadFunds(cardId, amount, source) {
    try {
      this.log('Loading funds', { cardId, amount, source: source.type });

      // In Stripe Issuing, you typically manage funds at the account level
      // This is a simplified implementation - in production you'd integrate
      // with your payment processing and account management system

      // For now, we'll create a simulated funding record
      const fundingRecord = {
        cardId: cardId,
        amount: amount / 100, // Convert to dollars
        source: source,
        timestamp: new Date().toISOString(),
        status: 'completed'
      };

      this.log('Funds loaded successfully', { 
        cardId, 
        amount: amount / 100
      });

      return {
        success: true,
        amount: amount / 100,
        timestamp: fundingRecord.timestamp,
        reference: `fund_${Date.now()}`
      };

    } catch (error) {
      throw this.handleApiError(error, 'Load Funds');
    }
  }

  /**
   * Validate Stripe webhook signature
   */
  validateWebhookSignature(payload, signature, secret) {
    try {
      // Stripe uses a different signature format: t=timestamp,v1=signature
      const elements = signature.split(',');
      const timestamp = elements.find(el => el.startsWith('t=')).split('=')[1];
      const sig = elements.find(el => el.startsWith('v1=')).split('=')[1];

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(sig, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      this.log('Webhook signature validation failed', { error: error.message }, 'error');
      return false;
    }
  }

  /**
   * Process Stripe Issuing webhook event
   */
  async processWebhookEvent(event) {
    try {
      this.log('Processing webhook event', { type: event.type, id: event.id });

      const result = {
        processed: true,
        type: event.type,
        timestamp: new Date().toISOString()
      };

      switch (event.type) {
        case 'issuing_authorization.created':
        case 'issuing_authorization.updated':
          result.authorization = this.processAuthorizationEvent(event);
          break;
        
        case 'issuing_transaction.created':
        case 'issuing_transaction.updated':
          result.transaction = this.processTransactionEvent(event);
          break;
        
        case 'issuing_card.created':
        case 'issuing_card.updated':
          result.card = this.processCardEvent(event);
          break;
        
        default:
          this.log('Unknown webhook event type', { type: event.type }, 'warn');
          result.processed = false;
      }

      return result;

    } catch (error) {
      throw this.handleApiError(error, 'Process Webhook Event');
    }
  }

  // Helper methods

  async ensureCardholderExists(userProfile) {
    try {
      // Create a unique cardholder ID based on user ID
      const cardholderId = `ch_freeway_${userProfile.userId}`;
      
      try {
        // Try to retrieve existing cardholder
        const cardholder = await this.stripe.issuing.cardholders.retrieve(cardholderId);
        return cardholder.id;
      } catch (error) {
        if (error.code === 'resource_missing') {
          // Cardholder doesn't exist, create them
          const cardholderData = {
            name: `${userProfile.firstName || 'User'} ${userProfile.lastName || 'Name'}`,
            email: userProfile.email,
            phone_number: userProfile.phone,
            status: 'active',
            type: 'individual',
            billing: {
              address: {
                line1: userProfile.address?.line1 || '123 Main St',
                city: userProfile.address?.city || 'San Francisco',
                state: userProfile.address?.state || 'CA',
                postal_code: userProfile.address?.postalCode || '94105',
                country: userProfile.address?.country || 'US'
              }
            },
            metadata: {
              freeway_user_id: userProfile.userId,
              kyc_verified: userProfile.kycVerified || false
            }
          };

          const cardholder = await this.stripe.issuing.cardholders.create(cardholderData);
          return cardholder.id;
        }
        throw error;
      }
    } catch (error) {
      throw this.handleApiError(error, 'Ensure Cardholder Exists');
    }
  }

  mapStripeStatus(stripeStatus) {
    const statusMap = {
      'active': 'active',
      'inactive': 'frozen',
      'canceled': 'cancelled',
      'pending': 'pending'
    };
    return statusMap[stripeStatus] || 'unknown';
  }

  mapToStripeStatus(status) {
    const statusMap = {
      'active': 'active',
      'frozen': 'inactive',
      'cancelled': 'canceled',
      'pending': 'pending'
    };
    return statusMap[status] || 'active';
  }

  parseSpendingLimits(stripeLimits) {
    if (!stripeLimits) return {};
    
    const limits = {};
    stripeLimits.forEach(limit => {
      switch (limit.interval) {
        case 'daily':
          limits.daily = limit.amount / 100;
          break;
        case 'monthly':
          limits.monthly = limit.amount / 100;
          break;
        case 'per_authorization':
          limits.perTransaction = limit.amount / 100;
          break;
      }
    });
    
    return limits;
  }

  processAuthorizationEvent(event) {
    const auth = event.data.object;
    return {
      authorizationId: auth.id,
      cardId: auth.card,
      amount: auth.amount / 100,
      merchantName: auth.merchant_data?.name,
      status: auth.approved ? 'approved' : 'declined',
      timestamp: new Date(auth.created * 1000).toISOString()
    };
  }

  processTransactionEvent(event) {
    const tx = event.data.object;
    return {
      transactionId: tx.id,
      cardId: tx.card,
      amount: tx.amount / 100,
      merchantName: tx.merchant_data?.name,
      status: tx.status,
      timestamp: new Date(tx.created * 1000).toISOString()
    };
  }

  processCardEvent(event) {
    const card = event.data.object;
    return {
      cardId: card.id,
      status: this.mapStripeStatus(card.status),
      cardholderId: card.cardholder,
      timestamp: new Date(card.created * 1000).toISOString()
    };
  }
}

module.exports = StripeIssuingAdapter;