const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VirtualCard',
    required: false // Not all transactions are card-related
  },
  
  // Enhanced transaction types
  type: {
    type: String,
    enum: [
      'add_funds', 'card_funding', 'bank_transfer', 'crypto_deposit', 
      'card_purchase', 'withdrawal', 'authorization', 'purchase', 
      'reversal', 'chargeback', 'refund', 'unknown'
    ],
    required: true
  },
  
  // Financial data
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  // Enhanced status tracking
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  
  // Card issuer integration fields
  issuerTransactionId: {
    type: String,
    index: true,
    sparse: true // Allow null values but index non-null ones
  },
  issuerEventType: {
    type: String,
    enum: ['authorization', 'clearing', 'settlement', 'reversal', 'chargeback', 'webhook']
  },
  
  // Processing status (for real-time transactions)
  processingStatus: {
    type: String,
    enum: ['pending', 'approved', 'declined', 'settled', 'reversed'],
    default: 'pending'
  },
  
  // Merchant information (for card transactions)
  merchantInfo: {
    name: {
      type: String,
      maxlength: 100
    },
    category: {
      type: String,
      maxlength: 50
    },
    location: {
      type: String,
      maxlength: 100
    },
    mcc: {
      type: String,
      maxlength: 10
    }
  },
  
  // Authorization details
  authorizationCode: {
    type: String,
    maxlength: 20
  },
  
  // Related transactions (for reversals, chargebacks)
  relatedTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  
  // Legacy fields (for backward compatibility)
  paymentMethod: String,
  transactionId: String,
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Compliance and audit
  ipAddress: String,
  userAgent: String,
  
  // Balance tracking
  balanceBefore: Number,
  balanceAfter: Number
}, {
  timestamps: true
});

// Indexes for performance
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ cardId: 1, createdAt: -1 });
transactionSchema.index({ issuerTransactionId: 1 }, { unique: true, sparse: true });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });

// Virtual fields
transactionSchema.virtual('isCardTransaction').get(function() {
  return ['authorization', 'purchase', 'card_purchase'].includes(this.type);
});

transactionSchema.virtual('isReversal').get(function() {
  return ['reversal', 'chargeback', 'refund'].includes(this.type);
});

transactionSchema.virtual('displayAmount').get(function() {
  const sign = this.isReversal ? '+' : '-';
  return `${sign}${this.currency} ${this.amount.toFixed(2)}`;
});

// Instance methods
transactionSchema.methods.updateStatus = function(status, processingStatus = null) {
  this.status = status;
  if (processingStatus) {
    this.processingStatus = processingStatus;
  }
  this.updatedAt = new Date();
};

transactionSchema.methods.addMetadata = function(key, value) {
  if (!this.metadata) {
    this.metadata = {};
  }
  this.metadata[key] = value;
};

transactionSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  
  // Remove sensitive fields if any
  delete obj.ipAddress;
  delete obj.userAgent;
  
  // Add computed fields
  obj.isCardTransaction = this.isCardTransaction;
  obj.isReversal = this.isReversal;
  obj.displayAmount = this.displayAmount;
  
  return obj;
};

// Static methods
transactionSchema.statics.findByUserId = function(userId, options = {}) {
  const query = { userId };
  
  if (options.cardId) {
    query.cardId = options.cardId;
  }
  
  if (options.type) {
    query.type = options.type;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.dateRange) {
    query.createdAt = {
      $gte: new Date(options.dateRange.start),
      $lte: new Date(options.dateRange.end)
    };
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.offset || 0);
};

transactionSchema.statics.findByIssuerTransactionId = function(issuerTransactionId) {
  return this.findOne({ issuerTransactionId });
};

transactionSchema.statics.getCardTransactionSummary = function(cardId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        cardId: cardId,
        createdAt: { $gte: startDate },
        type: { $in: ['authorization', 'purchase', 'card_purchase'] }
      }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        maxAmount: { $max: '$amount' }
      }
    }
  ]);
};

transactionSchema.statics.getDailySpending = function(cardId, date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.aggregate([
    {
      $match: {
        cardId: cardId,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        type: { $in: ['authorization', 'purchase', 'card_purchase'] },
        status: { $in: ['completed', 'pending'] }
      }
    },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: '$amount' },
        transactionCount: { $sum: 1 }
      }
    }
  ]);
};

// Pre-save middleware
transactionSchema.pre('save', function(next) {
  // Ensure currency is uppercase
  if (this.currency) {
    this.currency = this.currency.toUpperCase();
  }
  
  // Set default description if empty
  if (!this.description) {
    this.description = `${this.type} transaction`;
  }
  
  next();
});

// Post-save middleware for audit logging
transactionSchema.post('save', function(doc) {
  console.log(`Transaction saved: ${doc._id} - ${doc.type} - ${doc.amount} ${doc.currency}`);
});

module.exports = mongoose.model('Transaction', transactionSchema);