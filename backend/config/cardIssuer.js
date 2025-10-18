const MarqetaAdapter = require('../adapters/MarqetaAdapter');
const StripeIssuingAdapter = require('../adapters/StripeIssuingAdapter');

/**
 * Card Issuer Configuration and Factory
 * Manages different card issuer providers and their configurations
 */
class CardIssuerConfig {
  constructor() {
    this.providers = {
      marqeta: {
        name: 'Marqeta',
        adapter: MarqetaAdapter,
        config: {
          baseUrl: process.env.MARQETA_BASE_URL || 'https://sandbox-api.marqeta.com/v3',
          applicationToken: process.env.MARQETA_APPLICATION_TOKEN,
          adminAccessToken: process.env.MARQETA_ADMIN_ACCESS_TOKEN,
          webhookSecret: process.env.MARQETA_WEBHOOK_SECRET,
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
        }
      },
      stripe: {
        name: 'Stripe Issuing',
        adapter: StripeIssuingAdapter,
        config: {
          apiKey: process.env.STRIPE_SECRET_KEY,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'test'
        }
      },
      mock: {
        name: 'Mock Provider',
        adapter: null, // Will use existing mock service
        config: {
          environment: 'development'
        }
      }
    };

    // Default provider based on environment
    this.defaultProvider = process.env.CARD_ISSUER_PROVIDER || 'mock';
    
    // Feature flags
    this.featureFlags = {
      useRealCards: process.env.USE_REAL_CARDS === 'true',
      enableWebhooks: process.env.ENABLE_CARD_WEBHOOKS === 'true',
      enableFraudDetection: process.env.ENABLE_FRAUD_DETECTION === 'true'
    };
  }

  /**
   * Get card issuer adapter instance
   * @param {string} provider - Provider name (marqeta, stripe, mock)
   * @returns {CardIssuerAdapter} Configured adapter instance
   */
  getAdapter(provider = null) {
    const providerName = provider || this.defaultProvider;
    const providerConfig = this.providers[providerName];

    if (!providerConfig) {
      throw new Error(`Unknown card issuer provider: ${providerName}`);
    }

    // Return mock service for development or when real cards are disabled
    if (providerName === 'mock' || !this.featureFlags.useRealCards) {
      return require('../services/cardIssuer'); // Existing mock service
    }

    // Validate required configuration
    this.validateProviderConfig(providerName, providerConfig.config);

    // Create and return adapter instance
    const AdapterClass = providerConfig.adapter;
    return new AdapterClass(providerConfig.config);
  }

  /**
   * Validate provider configuration
   * @param {string} provider - Provider name
   * @param {Object} config - Provider configuration
   */
  validateProviderConfig(provider, config) {
    const requiredFields = {
      marqeta: ['applicationToken', 'adminAccessToken'],
      stripe: ['apiKey']
    };

    const required = requiredFields[provider] || [];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required configuration for ${provider}: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Get available providers
   * @returns {Array} List of available providers
   */
  getAvailableProviders() {
    return Object.keys(this.providers).map(key => ({
      key,
      name: this.providers[key].name,
      available: this.isProviderAvailable(key)
    }));
  }

  /**
   * Check if a provider is properly configured
   * @param {string} provider - Provider name
   * @returns {boolean} Whether provider is available
   */
  isProviderAvailable(provider) {
    if (provider === 'mock') return true;

    try {
      const config = this.providers[provider]?.config;
      if (!config) return false;

      this.validateProviderConfig(provider, config);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current configuration status
   * @returns {Object} Configuration status
   */
  getStatus() {
    return {
      defaultProvider: this.defaultProvider,
      featureFlags: this.featureFlags,
      providers: this.getAvailableProviders(),
      environment: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * Get webhook configuration for a provider
   * @param {string} provider - Provider name
   * @returns {Object} Webhook configuration
   */
  getWebhookConfig(provider = null) {
    const providerName = provider || this.defaultProvider;
    const providerConfig = this.providers[providerName];

    if (!providerConfig || !this.featureFlags.enableWebhooks) {
      return { enabled: false };
    }

    return {
      enabled: true,
      provider: providerName,
      secret: providerConfig.config.webhookSecret,
      endpoints: {
        marqeta: '/api/webhooks/marqeta',
        stripe: '/api/webhooks/stripe-issuing'
      }[providerName]
    };
  }

  /**
   * Switch provider (for testing or failover)
   * @param {string} provider - New provider name
   */
  switchProvider(provider) {
    if (!this.providers[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    if (!this.isProviderAvailable(provider)) {
      throw new Error(`Provider ${provider} is not properly configured`);
    }

    this.defaultProvider = provider;
    console.log(`Switched to card issuer provider: ${provider}`);
  }

  /**
   * Get provider-specific card product configuration
   * @param {string} provider - Provider name
   * @param {string} cardType - Card type (visa, mastercard)
   * @returns {Object} Card product configuration
   */
  getCardProductConfig(provider, cardType) {
    const configs = {
      marqeta: {
        visa: {
          cardProductToken: process.env.MARQETA_VISA_PRODUCT_TOKEN || 'freeway_visa_product',
          bin: '4111',
          features: ['virtual', 'instant_issue']
        },
        mastercard: {
          cardProductToken: process.env.MARQETA_MC_PRODUCT_TOKEN || 'freeway_mc_product',
          bin: '5555',
          features: ['virtual', 'instant_issue']
        }
      },
      stripe: {
        visa: {
          brand: 'visa',
          features: ['virtual', 'instant_issue']
        },
        mastercard: {
          brand: 'mastercard',
          features: ['virtual', 'instant_issue']
        }
      }
    };

    return configs[provider]?.[cardType] || {};
  }
}

// Export singleton instance
module.exports = new CardIssuerConfig();