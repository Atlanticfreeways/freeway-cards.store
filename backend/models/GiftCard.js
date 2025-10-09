const mongoose = require('mongoose');

const giftCardSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    min: 5
  },
  balance: {
    type: Number,
    required: true
  },
  design: {
    type: String,
    enum: ['general', 'birthday', 'holiday', 'business'],
    default: 'general'
  },
  recipientName: {
    type: String,
    required: true
  },
  recipientEmail: String,
  message: String,
  purchasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'redeemed', 'expired'],
    default: 'active'
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('GiftCard', giftCardSchema);