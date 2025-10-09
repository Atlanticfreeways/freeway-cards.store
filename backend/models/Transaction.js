const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['add_funds', 'purchase', 'redeem', 'withdrawal'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  giftCardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GiftCard'
  },
  paymentMethod: String,
  transactionId: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);