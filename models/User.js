const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  accountType: { type: String, enum: ['individual', 'business'], required: true },
  googleId: { type: String },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  kycStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  walletBalance: { type: Number, default: 0 },
  bitnobCustomerId: { type: String }
}, { timestamps: true });

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);