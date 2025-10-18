const axios = require('axios');
const crypto = require('crypto');
const CardIssuerAdapter = require('./CardIssuerAdapter');

/**
 * Marqeta card issuer adapter implementation
 * Integrates with Marqeta's card issuing platform
 */
class MarqetaAdapter extends CardIssuerAdapter {
  constructor(config) {
    super(config);
    
    // Marqeta-specific configuration
    this.applicationToken = config.applicationToken;
    this.adminAccessToken = config.adminAccessToken;
    
    // Set up axios instance with authentication
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      auth: {
        username: this.applicationToken,
        password: this.adminAccessToken
      }
    });

    // Add request/response interceptors for logging
    this.setupInterceptors();
  }

  setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        this.log('API Request', {
          method: config.method.toUpperCase(),
          url: config.url,
          data: config.data ? 'Present' : 'None'
        });
        return config;
      },
      (error) => {
        this.log('Request Error', { error: error.message }, 'error');
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.log('API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.log('Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.message
        }, 'error');
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a new virtual card using Marqeta API
   */
  async createCard(userProfile, cardConfig) {
    try {
      this.log('Creating card', { userId: userProfile.userId, cardType: cardConfig.cardType });

      // First, ensure user exists in Marqeta
      const userToken = await this.ensureUserExists(userProfile);

      // Create card product if needed
      const cardProductToken = await this.getCardProductToken(cardConfig.cardType);

      // Create the card
      const cardData = {
        user_token: userToken,
        card_product_token: cardProductToken,
        expedite: false,
        metadata: {
          card_name: cardConfig.cardName || 'Virtual Card',
          spending_limit_daily: cardConfig.spendingLimits?.daily || 1000,
          spending_limit_monthly: cardConfig.spendingLimits?.monthly || 5000,
          created_by: 'freeway_cards_platform'
        }
      };

      const response = await this.retryWithBackoff(async () => {
        return await this.client.post('/cards', cardData);
      });

      const card = response.data;

      // Set initial spending limits if specified
      if (cardConfig.spendingLimits) {
        await this.setSpendingLimits(card.token, cardConfig.spendingLimits);
      }

      this.log('Card created successfully', { cardToken: card.token });

      return {
        externalCardId: card.token,
        cardNumber: card.pan,
        expiryMonth: card.expiration_time.slice(0, 2),
        expiryYear: card.expiration_time.slice(2, 4),
        cvv: card.cvv_number,
        status: this.mapMarqetaStatus(card.state),
        issuerData: {
          userToken: card.user_token,
          cardProductToken: card.card_product_token,
          created: card.created_time,
          lastModified: card.last_modified_time
        }
      };

    } catch (error) {
      throw this.handleApiError(error, 'Card Creation');
    }
  }

  /**
   * Update card status in Marqeta
   */
  async updateCardStatus(cardId, status, reason = '') {
    try {
      this.log('Updating card status', { cardId, status, reason });

      const marqetaState = this.mapToMarqetaStatus(status);
      const transitionData = {
        channel: 'API',
        state: marqetaState,
        reason_code: this.getReasonCode(status, reason)
      };

      const response = await this.retryWithBackoff(async () => {
        return await this.client.post(`/cards/${cardId}/transitions`, transitionData);
      });

      this.log('Card status updated', { cardId, newStatus: response.data.state });

      return {
        success: true,
        status: this.mapMarqetaStatus(response.data.state),
        transitionToken: response.data.token,
        timestamp: response.data.created_time
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

      // Marqeta uses velocity controls for spending limits
      const velocityControls = [];

      if (limits.daily) {
        velocityControls.push({
          amount_limit: limits.daily * 100, // Convert to cents
          velocity_window: 'DAY',
          usage_limit: 999999 // No transaction count limit
        });
      }

      if (limits.monthly) {
        velocityControls.push({
          amount_limit: limits.monthly * 100,
          velocity_window: 'MONTH',
          usage_limit: 999999
        });
      }

      if (limits.perTransaction) {
        velocityControls.push({
          amount_limit: limits.perTransaction * 100,
          velocity_window: 'TRANSACTION',
          usage_limit: 1
        });
      }

      // Create velocity control for the card
      const velocityData = {
        token: `velocity_${cardId}_${Date.now()}`,
        name: `Spending Limits for ${cardId}`,
        association: {
          card_token: cardId
        },
        velocity_window: 'DAY',
        amount_limit: limits.daily ? limits.daily * 100 : 100000,
        usage_limit: 999999,
        currency_code: 'USD'
      };

      const response = await this.retryWithBackoff(async () => {
        return await this.client.post('/velocitycontrols', velocityData);
      });

      this.log('Spending limits set', { cardId, controlToken: response.data.token });

      return {
        success: true,
        controlToken: response.data.token,
        limits: limits
      };

    } catch (error) {
      throw this.handleApiError(error, 'Set Spending Limits');
    }
  }

  /**
   * Get card details from Marqeta
   */
  async getCardDetails(cardId) {
    try {
      this.log('Getting card details', { cardId });

      const response = await this.retryWithBackoff(async () => {
        return await this.client.get(`/cards/${cardId}`);
      });

      const card = response.data;

      return {
        cardId: card.token,
        status: this.mapMarqetaStatus(card.state),
        balance: await this.getCardBalance(cardId),
        cardNumber: card.pan,
        expiryMonth: card.expiration_time.slice(0, 2),
        expiryYear: card.expiration_time.slice(2, 4),
        userToken: card.user_token,
        created: card.created_time,
        lastModified: card.last_modified_time
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
        card_token: cardId,
        count: filters.limit || 50,
        start_index: filters.offset || 0
      };

      if (filters.startDate) {
        params.start_date = filters.startDate;
      }
      if (filters.endDate) {
        params.end_date = filters.endDate;
      }

      const response = await this.retryWithBackoff(async () => {
        return await this.client.get('/transactions', { params });
      });

      const transactions = response.data.data.map(tx => ({
        transactionId: tx.token,
        amount: tx.amount / 100, // Convert from cents
        currency: tx.currency_code,
        merchantName: tx.merchant?.name || 'Unknown Merchant',
        merchantCategory: tx.merchant?.mcc || 'Unknown',
        status: tx.state,
        type: tx.type,
        timestamp: tx.created_time,
        authorizationCode: tx.network_reference_id
      }));

      return transactions;

    } catch (error) {
      throw this.handleApiError(error, 'Get Transaction History');
    }
  }

  /**
   * Load funds onto a card (via GPA - General Purpose Account)
   */
  async loadFunds(cardId, amount, source) {
    try {
      this.log('Loading funds', { cardId, amount, source: source.type });

      // Get the user token for this card
      const cardDetails = await this.getCardDetails(cardId);
      const userToken = cardDetails.userToken;

      // Create GPA order to load funds
      const orderData = {
        user_token: userToken,
        amount: amount, // Amount in cents
        currency_code: 'USD',
        funding_source_token: source.fundingSourceToken || 'default_funding_source',
        tags: ['freeway_cards_funding']
      };

      const response = await this.retryWithBackoff(async () => {
        return await this.client.post('/gpaorders', orderData);
      });

      this.log('Funds loaded successfully', { 
        cardId, 
        amount, 
        orderToken: response.data.token 
      });

      return {
        success: true,
        amount: amount / 100, // Convert back to dollars
        orderToken: response.data.token,
        timestamp: response.data.created_time
      };

    } catch (error) {
      throw this.handleApiError(error, 'Load Funds');
    }
  }

  /**
   * Validate Marqeta webhook signature
   */
  validateWebhookSignature(payload, signature, secret) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      this.log('Webhook signature validation failed', { error: error.message }, 'error');
      return false;
    }
  }

  /**
   * Process Marqeta webhook event
   */
  async processWebhookEvent(event) {
    try {
      this.log('Processing webhook event', { type: event.type, token: event.token });

      const result = {
        processed: true,
        type: event.type,
        timestamp: new Date().toISOString()
      };

      switch (event.type) {
        case 'transaction.authorization':
        case 'transaction.clearing':
          result.transaction = this.processTransactionEvent(event);
          break;
        
        case 'card.transition':
          result.cardStatus = this.processCardStatusEvent(event);
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

  async ensureUserExists(userProfile) {
    try {
      // Check if user exists
      const userToken = `user_${userProfile.userId}`;
      
      try {
        await this.client.get(`/users/${userToken}`);
        return userToken;
      } catch (error) {
        if (error.response?.status === 404) {
          // User doesn't exist, create them
          const userData = {
            token: userToken,
            first_name: userProfile.firstName || 'User',
            last_name: userProfile.lastName || 'Name',
            email: userProfile.email,
            phone: userProfile.phone,
            metadata: {
              freeway_user_id: userProfile.userId,
              kyc_verified: userProfile.kycVerified || false
            }
          };

          const response = await this.client.post('/users', userData);
          return response.data.token;
        }
        throw error;
      }
    } catch (error) {
      throw this.handleApiError(error, 'Ensure User Exists');
    }
  }

  async getCardProductToken(cardType) {
    // In production, you would have pre-configured card products
    // For now, return a default token based on card type
    return cardType === 'visa' ? 'freeway_visa_product' : 'freeway_mastercard_product';
  }

  async getCardBalance(cardId) {
    try {
      const response = await this.client.get(`/balances/${cardId}`);
      return response.data.available_balance / 100; // Convert from cents
    } catch (error) {
      this.log('Failed to get card balance', { cardId, error: error.message }, 'warn');
      return 0;
    }
  }

  mapMarqetaStatus(marqetaState) {
    const statusMap = {
      'ACTIVE': 'active',
      'SUSPENDED': 'frozen',
      'TERMINATED': 'cancelled',
      'UNACTIVATED': 'pending'
    };
    return statusMap[marqetaState] || 'unknown';
  }

  mapToMarqetaStatus(status) {
    const statusMap = {
      'active': 'ACTIVE',
      'frozen': 'SUSPENDED',
      'cancelled': 'TERMINATED',
      'pending': 'UNACTIVATED'
    };
    return statusMap[status] || 'ACTIVE';
  }

  getReasonCode(status, reason) {
    if (status === 'frozen') return '01'; // Fraud
    if (status === 'cancelled') return '02'; // User request
    return '00'; // Normal operation
  }

  processTransactionEvent(event) {
    return {
      transactionId: event.token,
      cardId: event.card_token,
      amount: event.amount / 100,
      merchantName: event.merchant?.name,
      status: event.state,
      timestamp: event.created_time
    };
  }

  processCardStatusEvent(event) {
    return {
      cardId: event.card_token,
      oldStatus: this.mapMarqetaStatus(event.previous_state),
      newStatus: this.mapMarqetaStatus(event.state),
      timestamp: event.created_time
    };
  }
}

module.exports = MarqetaAdapter;