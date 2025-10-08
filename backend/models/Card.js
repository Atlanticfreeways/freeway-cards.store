const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bitnobCardId: { type: String, required: true },
  cardType: { type: String, enum: ['visa', 'mastercard'], required: true },
  subscriptionType: { type: String, enum: ['instant', 'subscription'], required: true },
  cardNumber: { type: String, required: true },
  expiryDate: { type: String, required: true },
  cvv: { type: String, required: true },
  balance: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'frozen', 'expired'], default: 'active' },
  spendingLimit: { type: Number, default: 1000 },
  expiresAt: { type: Date }
}, { timestamps: true });

// Indexes
cardSchema.index({ userId: 1 });
cardSchema.index({ bitnobCardId: 1 });
cardSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Card', cardSchema);
