const mongoose = require('mongoose');
const secureCardStorage = require('../utils/secureCardStorage');

const virtualCardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Card Issuer Integration Fields
  issuerProvider: {
    type: String,
    enum: ['marqeta', 'stripe', 'mock'],
    required: true,
    default: 'mock'
  },
  issuerCardId: {
    type: String,
    required: true,
    index: true
  },
  issuerCardToken: {
    type: String,
    required: false // Some providers may not use tokens
  },
  
  // Encrypted Card Data (PCI DSS Compliant)
  encryptedCardNumber: {
    type: String,
    required: true
  },
  encryptedCvv: {
    type: String,
    required: true
  },
  
  // Non-sensitive card data
  last4Digits: {
    type: String,
    required: true,
    length: 4
  },
  expiryMonth: {
    type: String,
    required: true,
    match: /^(0[1-9]|1[0-2])$/
  },
  expiryYear: {
    type: String,
    required: true,
    match: /^\d{2}$/
  },
  cardBrand: {
    type: String,
    enum: ['visa', 'mastercard', 'amex', 'discover', 'unknown'],
    required: true
  },
  cardType: {
    type: String,
    enum: ['mastercard', 'visa'],
    required: true
  },
  cardName: {
    type: String,
    required: true,
    maxlength: 50
  },
  
  // Financial Data
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Enhanced Spending Limits
  spendingLimits: {
    daily: {
      type: Number,
      default: 1000,
      min: 0,
      max: 10000
    },
    monthly: {
      type: Number,
      default: 5000,
      min: 0,
      max: 50000
    },
    perTransaction: {
      type: Number,
      default: 500,
      min: 0,
      max: 5000
    }
  },
  
  // Enhanced Status Tracking
  status: {
    type: String,
    enum: ['pending', 'active', 'frozen', 'suspended', 'closed'],
    default: 'pending'
  },
  statusReason: {
    type: String,
    maxlength: 200
  },
  
  // Card Properties
  isVirtual: {
    type: Boolean,
    default: true
  },
  merchantCategories: [{
    type: String,
    enum: ['online', 'retail', 'gas', 'grocery', 'entertainment', 'travel', 'all']
  }],
  
  // Compliance and Security
  kycVerified: {
    type: Boolean,
    required: true,
    default: false
  },
  complianceFlags: [{
    type: String,
    enum: ['fraud_alert', 'high_risk', 'manual_review', 'velocity_exceeded']
  }],
  
  // Synchronization
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed'],
    default: 'synced'
  },
  
  // Legacy fields for backward compatibility
  cardNumber: {
    type: String,
    required: false // Will be deprecated in favor of encryptedCardNumber
  },
  cvv: {
    type: String,
    required: false // Will be deprecated in favor of encryptedCvv
  },
  spendingLimit: {
    type: Number,
    required: false // Will be deprecated in favor of spendingLimits
  },
  externalCardId: {
    type: String,
    required: false // Will be deprecated in favor of issuerCardId
  }
}, {
  timestamps: true
});

// Indexes for performance
virtualCardSchema.index({ userId: 1, status: 1 });
virtualCardSchema.index({ issuerProvider: 1, issuerCardId: 1 });
virtualCardSchema.index({ last4Digits: 1 });
virtualCardSchema.index({ createdAt: -1 });

// Virtual fields
virtualCardSchema.virtual('maskedCardNumber').get(function() {
  return secureCardStorage.maskCardNumber(this.last4Digits);
});

virtualCardSchema.virtual('isExpired').get(function() {
  const now = new Date();
  const expiry = new Date(2000 + parseInt(this.expiryYear), parseInt(this.expiryMonth) - 1);
  return now > expiry;
});

virtualCardSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const expiry = new Date(2000 + parseInt(this.expiryYear), parseInt(this.expiryMonth) - 1);
  const diffTime = expiry - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance methods
virtualCardSchema.methods.getDecryptedCardNumber = function() {
  if (!this.encryptedCardNumber) {
    return this.cardNumber; // Fallback to legacy field
  }
  return secureCardStorage.decryptCardData(this.encryptedCardNumber, this.userId, this._id);
};

virtualCardSchema.methods.getDecryptedCvv = function() {
  if (!this.encryptedCvv) {
    return this.cvv; // Fallback to legacy field
  }
  return secureCardStorage.decryptCardData(this.encryptedCvv, this.userId, this._id);
};

virtualCardSchema.methods.setCardNumber = function(cardNumber) {
  this.encryptedCardNumber = secureCardStorage.encryptCardData(cardNumber, this.userId, this._id);
  this.last4Digits = secureCardStorage.getLast4Digits(cardNumber);
  this.cardBrand = secureCardStorage.detectCardBrand(cardNumber);
  
  // Clear legacy field
  this.cardNumber = undefined;
};

virtualCardSchema.methods.setCvv = function(cvv) {
  this.encryptedCvv = secureCardStorage.encryptCardData(cvv, this.userId, this._id);
  
  // Clear legacy field
  this.cvv = undefined;
};

virtualCardSchema.methods.updateSpendingLimits = function(limits) {
  if (limits.daily !== undefined) this.spendingLimits.daily = limits.daily;
  if (limits.monthly !== undefined) this.spendingLimits.monthly = limits.monthly;
  if (limits.perTransaction !== undefined) this.spendingLimits.perTransaction = limits.perTransaction;
  
  // Update legacy field for backward compatibility
  this.spendingLimit = this.spendingLimits.daily;
};

virtualCardSchema.methods.updateStatus = function(status, reason = '') {
  this.status = status;
  this.statusReason = reason;
  this.lastSyncedAt = new Date();
};

virtualCardSchema.methods.addComplianceFlag = function(flag) {
  if (!this.complianceFlags.includes(flag)) {
    this.complianceFlags.push(flag);
  }
};

virtualCardSchema.methods.removeComplianceFlag = function(flag) {
  this.complianceFlags = this.complianceFlags.filter(f => f !== flag);
};

virtualCardSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  
  // Remove sensitive fields
  delete obj.encryptedCardNumber;
  delete obj.encryptedCvv;
  delete obj.cardNumber; // Legacy field
  delete obj.cvv; // Legacy field
  
  // Add safe display fields
  obj.maskedCardNumber = this.maskedCardNumber;
  obj.isExpired = this.isExpired;
  obj.daysUntilExpiry = this.daysUntilExpiry;
  
  return obj;
};

// Static methods
virtualCardSchema.statics.findByUserId = function(userId, includeInactive = false) {
  const query = { userId };
  if (!includeInactive) {
    query.status = { $in: ['active', 'frozen'] };
  }
  return this.find(query).sort({ createdAt: -1 });
};

virtualCardSchema.statics.findByIssuerCardId = function(issuerProvider, issuerCardId) {
  return this.findOne({ issuerProvider, issuerCardId });
};

virtualCardSchema.statics.findExpiringSoon = function(days = 30) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(now.getDate() + days);
  
  return this.find({
    status: { $in: ['active', 'frozen'] },
    $expr: {
      $lte: [
        { $dateFromParts: { 
          year: { $add: [2000, { $toInt: '$expiryYear' }] },
          month: { $toInt: '$expiryMonth' }
        }},
        futureDate
      ]
    }
  });
};

// Pre-save middleware
virtualCardSchema.pre('save', function(next) {
  // Ensure last4Digits is set if we have a card number
  if (this.cardNumber && !this.last4Digits) {
    this.last4Digits = secureCardStorage.getLast4Digits(this.cardNumber);
  }
  
  // Ensure cardBrand is set
  if (this.cardNumber && !this.cardBrand) {
    this.cardBrand = secureCardStorage.detectCardBrand(this.cardNumber);
  }
  
  // Update legacy spendingLimit for backward compatibility
  if (this.spendingLimits && this.spendingLimits.daily) {
    this.spendingLimit = this.spendingLimits.daily;
  }
  
  // Update sync timestamp
  this.lastSyncedAt = new Date();
  
  next();
});

// Post-save middleware for audit logging
virtualCardSchema.post('save', function(doc) {
  secureCardStorage.logCardAccess(doc.userId, doc._id, 'save', 'success');
});

module.exports = mongoose.model('VirtualCard', virtualCardSchema);