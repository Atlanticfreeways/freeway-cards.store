/**
 * Feature Flag Service
 * Manages feature flags for gradual rollout and A/B testing
 */
class FeatureFlagService {
  constructor() {
    this.logger = require('../utils/logger');
    
    // Feature flags configuration
    this.flags = {
      // Card Issuer Features
      useRealCards: {
        enabled: process.env.USE_REAL_CARDS === 'true',
        description: 'Enable real card issuer integration',
        rolloutPercentage: 100,
        userSegments: ['all'],
        dependencies: []
      },
      
      enableWebhooks: {
        enabled: process.env.ENABLE_CARD_WEBHOOKS === 'true',
        description: 'Enable real-time webhook processing',
        rolloutPercentage: 100,
        userSegments: ['all'],
        dependencies: ['useRealCards']
      },
      
      enableFraudDetection: {
        enabled: process.env.ENABLE_FRAUD_DETECTION === 'true',
        description: 'Enable fraud detection and prevention',
        rolloutPercentage: 100,
        userSegments: ['all'],
        dependencies: []
      },
      
      // Advanced Features
      enableCryptoFunding: {
        enabled: process.env.ENABLE_CRYPTO_FUNDING === 'true',
        description: 'Enable cryptocurrency funding',
        rolloutPercentage: 50,
        userSegments: ['premium', 'beta'],
        dependencies: ['useRealCards']
      },
      
      enableInternationalCards: {
        enabled: process.env.ENABLE_INTERNATIONAL_CARDS === 'true',
        description: 'Enable international card transactions',
        rolloutPercentage: 25,
        userSegments: ['premium'],
        dependencies: ['useRealCards']
      },
      
      enableBusinessFeatures: {
        enabled: process.env.ENABLE_BUSINESS_FEATURES === 'true',
        description: 'Enable business account features',
        rolloutPercentage: 10,
        userSegments: ['business', 'enterprise'],
        dependencies: ['useRealCards']
      },
      
      // Experimental Features
      enableAIFraudDetection: {
        enabled: process.env.ENABLE_AI_FRAUD_DETECTION === 'true',
        description: 'Enable AI-powered fraud detection',
        rolloutPercentage: 5,
        userSegments: ['beta'],
        dependencies: ['enableFraudDetection']
      },
      
      enableRealTimeNotifications: {
        enabled: process.env.ENABLE_REALTIME_NOTIFICATIONS === 'true',
        description: 'Enable real-time push notifications',
        rolloutPercentage: 30,
        userSegments: ['premium', 'beta'],
        dependencies: []
      },
      
      enableAdvancedAnalytics: {
        enabled: process.env.ENABLE_ADVANCED_ANALYTICS === 'true',
        description: 'Enable advanced spending analytics',
        rolloutPercentage: 20,
        userSegments: ['premium'],
        dependencies: []
      },
      
      // Performance Features
      enableCaching: {
        enabled: process.env.ENABLE_CACHING === 'true',
        description: 'Enable response caching',
        rolloutPercentage: 100,
        userSegments: ['all'],
        dependencies: []
      },
      
      enableRateLimiting: {
        enabled: process.env.ENABLE_RATE_LIMITING !== 'false',
        description: 'Enable API rate limiting',
        rolloutPercentage: 100,
        userSegments: ['all'],
        dependencies: []
      }
    };

    // User segments definition
    this.userSegments = {
      all: () => true,
      premium: (user) => user.accountType === 'premium',
      business: (user) => user.accountType === 'business',
      enterprise: (user) => user.accountType === 'enterprise',
      beta: (user) => user.betaTester === true,
      new: (user) => {
        const accountAge = Date.now() - new Date(user.createdAt).getTime();
        return accountAge < 30 * 24 * 60 * 60 * 1000; // 30 days
      },
      verified: (user) => user.kycStatus === 'approved'
    };

    this.logger.info('Feature flag service initialized', {
      totalFlags: Object.keys(this.flags).length,
      enabledFlags: Object.keys(this.flags).filter(key => this.flags[key].enabled).length
    });
  }

  /**
   * Check if a feature is enabled for a user
   * @param {string} flagName - Feature flag name
   * @param {Object} user - User object (optional)
   * @param {Object} context - Additional context (optional)
   * @returns {boolean} Whether feature is enabled
   */
  isEnabled(flagName, user = null, context = {}) {
    try {
      const flag = this.flags[flagName];
      
      if (!flag) {
        this.logger.warn('Unknown feature flag requested', { flagName });
        return false;
      }

      // Check if flag is globally disabled
      if (!flag.enabled) {
        return false;
      }

      // Check dependencies
      if (flag.dependencies && flag.dependencies.length > 0) {
        for (const dependency of flag.dependencies) {
          if (!this.isEnabled(dependency, user, context)) {
            this.logger.debug('Feature flag disabled due to dependency', {
              flagName,
              dependency,
              user: user?.id
            });
            return false;
          }
        }
      }

      // Check user segments
      if (user && flag.userSegments && flag.userSegments.length > 0) {
        const userInSegment = flag.userSegments.some(segment => {
          const segmentCheck = this.userSegments[segment];
          return segmentCheck && segmentCheck(user);
        });

        if (!userInSegment) {
          return false;
        }
      }

      // Check rollout percentage
      if (flag.rolloutPercentage < 100) {
        const userId = user?.id || context.sessionId || 'anonymous';
        const hash = this.hashString(userId + flagName);
        const percentage = hash % 100;
        
        if (percentage >= flag.rolloutPercentage) {
          return false;
        }
      }

      return true;

    } catch (error) {
      this.logger.error('Feature flag check failed', {
        flagName,
        userId: user?.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get all enabled features for a user
   * @param {Object} user - User object
   * @param {Object} context - Additional context
   * @returns {Object} Enabled features
   */
  getEnabledFeatures(user = null, context = {}) {
    const enabledFeatures = {};
    
    Object.keys(this.flags).forEach(flagName => {
      enabledFeatures[flagName] = this.isEnabled(flagName, user, context);
    });

    return enabledFeatures;
  }

  /**
   * Update feature flag configuration
   * @param {string} flagName - Feature flag name
   * @param {Object} updates - Updates to apply
   * @returns {Object} Update result
   */
  updateFlag(flagName, updates) {
    try {
      if (!this.flags[flagName]) {
        return { success: false, message: 'Feature flag not found' };
      }

      const oldConfig = { ...this.flags[flagName] };
      this.flags[flagName] = { ...this.flags[flagName], ...updates };

      this.logger.info('Feature flag updated', {
        flagName,
        oldConfig,
        newConfig: this.flags[flagName]
      });

      return { 
        success: true, 
        message: 'Feature flag updated successfully',
        flag: this.flags[flagName]
      };

    } catch (error) {
      this.logger.error('Feature flag update failed', {
        flagName,
        error: error.message
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * Create a new feature flag
   * @param {string} flagName - Feature flag name
   * @param {Object} config - Flag configuration
   * @returns {Object} Creation result
   */
  createFlag(flagName, config) {
    try {
      if (this.flags[flagName]) {
        return { success: false, message: 'Feature flag already exists' };
      }

      const defaultConfig = {
        enabled: false,
        description: '',
        rolloutPercentage: 0,
        userSegments: ['all'],
        dependencies: []
      };

      this.flags[flagName] = { ...defaultConfig, ...config };

      this.logger.info('Feature flag created', {
        flagName,
        config: this.flags[flagName]
      });

      return { 
        success: true, 
        message: 'Feature flag created successfully',
        flag: this.flags[flagName]
      };

    } catch (error) {
      this.logger.error('Feature flag creation failed', {
        flagName,
        error: error.message
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * Delete a feature flag
   * @param {string} flagName - Feature flag name
   * @returns {Object} Deletion result
   */
  deleteFlag(flagName) {
    try {
      if (!this.flags[flagName]) {
        return { success: false, message: 'Feature flag not found' };
      }

      // Check if other flags depend on this one
      const dependentFlags = Object.keys(this.flags).filter(key => 
        this.flags[key].dependencies && this.flags[key].dependencies.includes(flagName)
      );

      if (dependentFlags.length > 0) {
        return { 
          success: false, 
          message: `Cannot delete flag - other flags depend on it: ${dependentFlags.join(', ')}` 
        };
      }

      delete this.flags[flagName];

      this.logger.info('Feature flag deleted', { flagName });

      return { success: true, message: 'Feature flag deleted successfully' };

    } catch (error) {
      this.logger.error('Feature flag deletion failed', {
        flagName,
        error: error.message
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * Get feature flag configuration
   * @param {string} flagName - Feature flag name (optional)
   * @returns {Object} Flag configuration(s)
   */
  getFlags(flagName = null) {
    if (flagName) {
      return this.flags[flagName] || null;
    }
    return this.flags;
  }

  /**
   * Get feature flag statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const totalFlags = Object.keys(this.flags).length;
    const enabledFlags = Object.keys(this.flags).filter(key => this.flags[key].enabled).length;
    const flagsByRollout = {};

    Object.entries(this.flags).forEach(([name, flag]) => {
      const rollout = flag.rolloutPercentage;
      if (!flagsByRollout[rollout]) {
        flagsByRollout[rollout] = [];
      }
      flagsByRollout[rollout].push(name);
    });

    return {
      totalFlags,
      enabledFlags,
      disabledFlags: totalFlags - enabledFlags,
      flagsByRollout,
      userSegments: Object.keys(this.userSegments)
    };
  }

  /**
   * Validate feature flag configuration
   * @param {Object} config - Flag configuration
   * @returns {Object} Validation result
   */
  validateFlagConfig(config) {
    const errors = [];

    if (typeof config.enabled !== 'boolean') {
      errors.push('enabled must be a boolean');
    }

    if (config.rolloutPercentage !== undefined) {
      if (typeof config.rolloutPercentage !== 'number' || 
          config.rolloutPercentage < 0 || 
          config.rolloutPercentage > 100) {
        errors.push('rolloutPercentage must be a number between 0 and 100');
      }
    }

    if (config.userSegments && !Array.isArray(config.userSegments)) {
      errors.push('userSegments must be an array');
    }

    if (config.dependencies && !Array.isArray(config.dependencies)) {
      errors.push('dependencies must be an array');
    }

    // Check if dependencies exist
    if (config.dependencies) {
      config.dependencies.forEach(dep => {
        if (!this.flags[dep]) {
          errors.push(`Dependency '${dep}' does not exist`);
        }
      });
    }

    // Check if user segments exist
    if (config.userSegments) {
      config.userSegments.forEach(segment => {
        if (!this.userSegments[segment]) {
          errors.push(`User segment '${segment}' does not exist`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Hash string for consistent percentage calculations
   * @param {string} str - String to hash
   * @returns {number} Hash value
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Export feature flags configuration
   * @returns {Object} Exportable configuration
   */
  exportConfig() {
    return {
      flags: this.flags,
      userSegments: Object.keys(this.userSegments),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import feature flags configuration
   * @param {Object} config - Configuration to import
   * @returns {Object} Import result
   */
  importConfig(config) {
    try {
      if (!config.flags) {
        return { success: false, message: 'Invalid configuration format' };
      }

      // Validate each flag
      const validationErrors = [];
      Object.entries(config.flags).forEach(([name, flagConfig]) => {
        const validation = this.validateFlagConfig(flagConfig);
        if (!validation.valid) {
          validationErrors.push(`${name}: ${validation.errors.join(', ')}`);
        }
      });

      if (validationErrors.length > 0) {
        return { 
          success: false, 
          message: 'Configuration validation failed',
          errors: validationErrors
        };
      }

      // Backup current configuration
      const backup = { ...this.flags };

      try {
        this.flags = { ...config.flags };
        
        this.logger.info('Feature flags configuration imported', {
          importedFlags: Object.keys(config.flags).length,
          importedAt: new Date()
        });

        return { 
          success: true, 
          message: 'Configuration imported successfully',
          importedFlags: Object.keys(config.flags).length
        };

      } catch (error) {
        // Restore backup on error
        this.flags = backup;
        throw error;
      }

    } catch (error) {
      this.logger.error('Feature flags import failed', {
        error: error.message
      });
      return { success: false, message: error.message };
    }
  }
}

module.exports = new FeatureFlagService();