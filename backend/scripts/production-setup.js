#!/usr/bin/env node

/**
 * Production Setup Script
 * Validates and configures the application for production deployment
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

class ProductionSetup {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.config = {};
  }

  /**
   * Run complete production setup validation
   */
  async run() {
    console.log('🚀 Freeway Cards - Production Setup Validator\n');

    try {
      this.validateEnvironment();
      this.validateSecurityConfig();
      await this.validateDatabaseConnection();
      this.validateCardIssuerConfig();
      this.generateMissingSecrets();
      await this.createDatabaseIndexes();
      this.validateSSLConfig();
      this.generateProductionChecklist();

      this.displayResults();
      
      if (this.errors.length === 0) {
        console.log('✅ Production setup validation completed successfully!');
        process.exit(0);
      } else {
        console.log('❌ Production setup validation failed. Please fix the errors above.');
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Setup validation failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate environment configuration
   */
  validateEnvironment() {
    console.log('📋 Validating environment configuration...');

    const requiredEnvVars = [
      'NODE_ENV',
      'MONGODB_URI',
      'JWT_SECRET',
      'CARD_ENCRYPTION_KEY',
      'CARD_ISSUER_PROVIDER'
    ];

    const productionEnvVars = [
      'STRIPE_SECRET_KEY',
      'ADMIN_EMAIL'
    ];

    // Check required variables
    requiredEnvVars.forEach(varName => {
      if (!process.env[varName]) {
        this.errors.push(`Missing required environment variable: ${varName}`);
      } else {
        this.config[varName] = process.env[varName];
      }
    });

    // Check production-specific variables
    if (process.env.NODE_ENV === 'production') {
      productionEnvVars.forEach(varName => {
        if (!process.env[varName]) {
          this.errors.push(`Missing production environment variable: ${varName}`);
        }
      });
    }

    // Validate NODE_ENV
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging') {
      this.warnings.push(`NODE_ENV is '${process.env.NODE_ENV}', expected 'production' or 'staging'`);
    }

    console.log('✓ Environment validation completed');
  }

  /**
   * Validate security configuration
   */
  validateSecurityConfig() {
    console.log('🔒 Validating security configuration...');

    // Validate JWT secret strength
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret) {
      if (jwtSecret.length < 32) {
        this.errors.push('JWT_SECRET must be at least 32 characters long');
      }
      if (jwtSecret === 'your-jwt-secret-key') {
        this.errors.push('JWT_SECRET is using default value - must be changed for production');
      }
    }

    // Validate encryption key
    const encryptionKey = process.env.CARD_ENCRYPTION_KEY;
    if (encryptionKey) {
      if (encryptionKey.length !== 64) {
        this.errors.push('CARD_ENCRYPTION_KEY must be exactly 64 hex characters (256 bits)');
      }
      if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
        this.errors.push('CARD_ENCRYPTION_KEY must contain only hexadecimal characters');
      }
      if (encryptionKey === 'generate_64_hex_characters_for_production_use') {
        this.errors.push('CARD_ENCRYPTION_KEY is using placeholder value - must be generated');
      }
    }

    // Validate admin email
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && !this.isValidEmail(adminEmail)) {
      this.errors.push('ADMIN_EMAIL must be a valid email address');
    }

    // Check for development/test values in production
    if (process.env.NODE_ENV === 'production') {
      const testPatterns = [
        'test', 'demo', 'example', 'localhost', 'your-', 'sk_test_', 'pk_test_'
      ];

      Object.keys(process.env).forEach(key => {
        const value = process.env[key];
        if (testPatterns.some(pattern => value.toLowerCase().includes(pattern))) {
          this.warnings.push(`${key} appears to contain test/demo values: ${value.substring(0, 20)}...`);
        }
      });
    }

    console.log('✓ Security validation completed');
  }

  /**
   * Validate database connection
   */
  async validateDatabaseConnection() {
    console.log('🗄️  Validating database connection...');

    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });

      console.log('✓ Database connection successful');

      // Check database name
      const dbName = mongoose.connection.db.databaseName;
      if (process.env.NODE_ENV === 'production' && dbName.includes('test')) {
        this.warnings.push(`Database name '${dbName}' contains 'test' - verify this is correct for production`);
      }

      // Test basic operations
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log(`✓ Database has ${collections.length} collections`);

    } catch (error) {
      this.errors.push(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Validate card issuer configuration
   */
  validateCardIssuerConfig() {
    console.log('💳 Validating card issuer configuration...');

    const provider = process.env.CARD_ISSUER_PROVIDER;
    const useRealCards = process.env.USE_REAL_CARDS === 'true';

    if (useRealCards) {
      if (provider === 'marqeta') {
        this.validateMarqetaConfig();
      } else if (provider === 'stripe') {
        this.validateStripeConfig();
      } else {
        this.errors.push(`Unknown card issuer provider: ${provider}`);
      }
    } else {
      this.warnings.push('USE_REAL_CARDS is false - running in mock mode');
    }

    console.log('✓ Card issuer validation completed');
  }

  /**
   * Validate Marqeta configuration
   */
  validateMarqetaConfig() {
    const requiredVars = [
      'MARQETA_APPLICATION_TOKEN',
      'MARQETA_ADMIN_ACCESS_TOKEN',
      'MARQETA_WEBHOOK_SECRET'
    ];

    requiredVars.forEach(varName => {
      if (!process.env[varName]) {
        this.errors.push(`Missing Marqeta configuration: ${varName}`);
      }
    });

    // Validate base URL
    const baseUrl = process.env.MARQETA_BASE_URL;
    if (baseUrl && baseUrl.includes('sandbox') && process.env.NODE_ENV === 'production') {
      this.warnings.push('MARQETA_BASE_URL appears to be sandbox URL in production environment');
    }
  }

  /**
   * Validate Stripe configuration
   */
  validateStripeConfig() {
    const requiredVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET'
    ];

    requiredVars.forEach(varName => {
      if (!process.env[varName]) {
        this.errors.push(`Missing Stripe configuration: ${varName}`);
      }
    });

    // Validate key format
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) {
      if (secretKey.startsWith('sk_test_') && process.env.NODE_ENV === 'production') {
        this.errors.push('STRIPE_SECRET_KEY is a test key but NODE_ENV is production');
      }
      if (!secretKey.startsWith('sk_live_') && !secretKey.startsWith('sk_test_')) {
        this.errors.push('STRIPE_SECRET_KEY format is invalid');
      }
    }
  }

  /**
   * Generate missing secrets
   */
  generateMissingSecrets() {
    console.log('🔑 Checking for missing secrets...');

    const secrets = {};

    // Generate JWT secret if missing
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-jwt-secret-key') {
      secrets.JWT_SECRET = crypto.randomBytes(64).toString('hex');
    }

    // Generate encryption key if missing
    if (!process.env.CARD_ENCRYPTION_KEY || process.env.CARD_ENCRYPTION_KEY === 'generate_64_hex_characters_for_production_use') {
      secrets.CARD_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    }

    if (Object.keys(secrets).length > 0) {
      console.log('\n🔑 Generated secrets (add these to your .env file):');
      console.log('=' .repeat(60));
      Object.entries(secrets).forEach(([key, value]) => {
        console.log(`${key}=${value}`);
      });
      console.log('=' .repeat(60));
      console.log('⚠️  Store these secrets securely and never commit them to version control!\n');
    }

    console.log('✓ Secret generation completed');
  }

  /**
   * Create database indexes
   */
  async createDatabaseIndexes() {
    console.log('📊 Creating database indexes...');

    if (!mongoose.connection.readyState) {
      this.warnings.push('Database not connected - skipping index creation');
      return;
    }

    try {
      const db = mongoose.connection.db;

      // Users indexes
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ kycStatus: 1 });
      await db.collection('users').createIndex({ createdAt: -1 });

      // VirtualCards indexes
      await db.collection('virtualcards').createIndex({ userId: 1, status: 1 });
      await db.collection('virtualcards').createIndex({ issuerProvider: 1, issuerCardId: 1 });
      await db.collection('virtualcards').createIndex({ last4Digits: 1 });
      await db.collection('virtualcards').createIndex({ createdAt: -1 });
      await db.collection('virtualcards').createIndex({ complianceFlags: 1 });

      // Transactions indexes
      await db.collection('transactions').createIndex({ userId: 1, createdAt: -1 });
      await db.collection('transactions').createIndex({ cardId: 1, createdAt: -1 });
      await db.collection('transactions').createIndex({ issuerTransactionId: 1 }, { unique: true, sparse: true });
      await db.collection('transactions').createIndex({ type: 1, status: 1 });
      await db.collection('transactions').createIndex({ createdAt: -1 });

      // KYC indexes
      await db.collection('kycs').createIndex({ userId: 1 }, { unique: true });
      await db.collection('kycs').createIndex({ status: 1 });

      console.log('✓ Database indexes created successfully');

    } catch (error) {
      this.warnings.push(`Index creation failed: ${error.message}`);
    }
  }

  /**
   * Validate SSL configuration
   */
  validateSSLConfig() {
    console.log('🔐 Validating SSL configuration...');

    // Check if running behind a proxy
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.TRUST_PROXY) {
        this.warnings.push('TRUST_PROXY not set - may cause issues if running behind a proxy/load balancer');
      }

      // Check CORS configuration
      if (!process.env.CORS_ORIGIN) {
        this.warnings.push('CORS_ORIGIN not set - may cause CORS issues in production');
      }
    }

    console.log('✓ SSL validation completed');
  }

  /**
   * Generate production checklist
   */
  generateProductionChecklist() {
    console.log('📋 Generating production checklist...');

    const checklist = `
# 🚀 Production Deployment Checklist

## Pre-Deployment
- [ ] All environment variables configured
- [ ] Database indexes created
- [ ] SSL certificates installed
- [ ] Card issuer API credentials configured
- [ ] Webhook endpoints configured in card issuer dashboard
- [ ] Admin email configured
- [ ] Monitoring and alerting configured

## Security
- [ ] JWT secret is strong and unique
- [ ] Card encryption key is generated and secure
- [ ] No test/demo values in production environment
- [ ] Firewall configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured

## Testing
- [ ] Load testing completed
- [ ] Security testing completed
- [ ] Webhook testing completed
- [ ] Card creation testing completed
- [ ] Fraud detection testing completed

## Monitoring
- [ ] Application monitoring configured
- [ ] Database monitoring configured
- [ ] Log aggregation configured
- [ ] Alert notifications configured
- [ ] Health check endpoints working

## Backup & Recovery
- [ ] Database backup configured
- [ ] Application backup configured
- [ ] Recovery procedures tested
- [ ] Incident response plan documented

## Go-Live
- [ ] DNS configured
- [ ] Load balancer configured
- [ ] CDN configured (if applicable)
- [ ] Team trained on production procedures
- [ ] Emergency contacts documented

Generated: ${new Date().toISOString()}
`;

    fs.writeFileSync('PRODUCTION_CHECKLIST.md', checklist);
    console.log('✓ Production checklist generated: PRODUCTION_CHECKLIST.md');
  }

  /**
   * Display validation results
   */
  displayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PRODUCTION SETUP VALIDATION RESULTS');
    console.log('='.repeat(60));

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS (must be fixed):');
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (should be reviewed):');
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n✅ All validations passed!');
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Run the setup if called directly
if (require.main === module) {
  const setup = new ProductionSetup();
  setup.run().catch(console.error);
}

module.exports = ProductionSetup;