const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'requires_review'],
    default: 'pending'
  },
  level: {
    type: String,
    enum: ['basic', 'enhanced', 'premium'],
    default: 'basic'
  },
  documents: {
    idDocument: {
      type: String, // Document type
      url: String,
      verified: { type: Boolean, default: false }
    },
    proofOfAddress: {
      type: String,
      url: String,
      verified: { type: Boolean, default: false }
    }
  },
  personalInfo: {
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
    nationality: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  limits: {
    dailySpending: { type: Number, default: 1000 },
    monthlySpending: { type: Number, default: 5000 },
    cardCount: { type: Number, default: 3 }
  },
  verificationDate: Date,
  rejectionReason: String
}, {
  timestamps: true
});

module.exports = mongoose.model('KYC', kycSchema);