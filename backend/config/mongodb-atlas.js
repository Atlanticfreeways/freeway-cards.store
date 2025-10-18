const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectAtlas = async () => {
  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 20,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    };

    await mongoose.connect(process.env.MONGODB_ATLAS_URI, options);
    
    // Create indexes for performance
    await createIndexes();
    
    console.log('✅ MongoDB Atlas connected successfully');
  } catch (error) {
    console.error('❌ MongoDB Atlas connection failed:', error.message);
    process.exit(1);
  }
};

const createIndexes = async () => {
  try {
    const User = require('../models/User');
    const VirtualCard = require('../models/VirtualCard');
    const Transaction = require('../models/Transaction');
    
    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ kycStatus: 1 });
    
    // Card indexes
    await VirtualCard.collection.createIndex({ userId: 1 });
    await VirtualCard.collection.createIndex({ cardNumber: 1 }, { unique: true });
    await VirtualCard.collection.createIndex({ status: 1 });
    
    // Transaction indexes
    await Transaction.collection.createIndex({ userId: 1, createdAt: -1 });
    await Transaction.collection.createIndex({ type: 1 });
    
    console.log('✅ Database indexes created');
  } catch (error) {
    console.error('❌ Index creation failed:', error.message);
  }
};

module.exports = { connectAtlas };