const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Connection pool configuration
const getConnectionOptions = () => {
  const baseOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  // Production SSL options
  if (process.env.NODE_ENV === 'production' && process.env.MONGODB_SSL === 'true') {
    baseOptions.ssl = true;
    baseOptions.sslValidate = true;
    if (process.env.MONGODB_SSL_CA) {
      baseOptions.sslCA = require('fs').readFileSync(process.env.MONGODB_SSL_CA);
    }
  }

  return baseOptions;
};

// Query performance monitoring
const setupQueryMonitoring = () => {
  if (process.env.NODE_ENV !== 'production') {
    mongoose.set('debug', (collectionName, method, query, doc) => {
      const start = Date.now();
      logger.debug('MongoDB Query', {
        collection: collectionName,
        method,
        query: JSON.stringify(query),
        timestamp: new Date().toISOString()
      });
    });
  }
};

// Comprehensive index creation
const createIndexes = async () => {
  try {
    const User = require('../models/User');
    const Card = require('../models/Card');
    const TokenBlacklist = require('../models/TokenBlacklist');
    
    // User indexes for performance
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ googleId: 1 }, { sparse: true });
    await User.collection.createIndex({ createdAt: -1 });
    await User.collection.createIndex({ isVerified: 1 });
    await User.collection.createIndex({ kycStatus: 1 });
    await User.collection.createIndex({ bitnobCustomerId: 1 }, { sparse: true });
    
    // Card indexes for performance
    await Card.collection.createIndex({ userId: 1 });
    await Card.collection.createIndex({ userId: 1, status: 1 });
    await Card.collection.createIndex({ userId: 1, createdAt: -1 });
    await Card.collection.createIndex({ bitnobCardId: 1 }, { unique: true });
    await Card.collection.createIndex({ expiresAt: 1 });
    await Card.collection.createIndex({ status: 1 });
    await Card.collection.createIndex({ cardType: 1 });
    
    // Token blacklist indexes
    await TokenBlacklist.collection.createIndex({ token: 1 }, { unique: true });
    await TokenBlacklist.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    
    // Compound indexes for common queries
    await Card.collection.createIndex({ userId: 1, status: 1, createdAt: -1 });
    await User.collection.createIndex({ email: 1, isVerified: 1 });
    
    logger.info('Database indexes created successfully');
  } catch (error) {
    logger.error('Index creation error', { error: error.message });
  }
};

// Connection monitoring
const setupConnectionMonitoring = () => {
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
};

// Memory leak prevention
const setupMemoryManagement = () => {
  // Monitor connection pool
  setInterval(() => {
    const stats = mongoose.connection.db?.stats();
    if (stats) {
      logger.debug('MongoDB connection stats', {
        connections: mongoose.connection.readyState,
        poolSize: mongoose.connection.db.serverConfig?.connections?.length || 0
      });
    }
  }, 60000); // Every minute
};

module.exports = { 
  createIndexes, 
  getConnectionOptions, 
  setupQueryMonitoring, 
  setupConnectionMonitoring, 
  setupMemoryManagement 
};