const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { generatePaymentAddress } = require('../utils/bitnob');
const csrfProtection = require('../middleware/csrf');
const { validateWalletFunding, validateWalletWithdrawal } = require('../middleware/validation');

const router = express.Router();

// Get wallet balance
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, balance: user.walletBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fund wallet with crypto
router.post('/fund', auth, csrfProtection, validateWalletFunding, async (req, res) => {
  try {
    const { cryptocurrency, amount } = req.body;
    
    const paymentData = await generatePaymentAddress(cryptocurrency.toUpperCase(), amount);
    
    res.json({ 
      success: true, 
      paymentAddress: paymentData.address,
      amount: paymentData.amount,
      currency: cryptocurrency.toUpperCase(),
      expiresAt: paymentData.expiresAt
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Withdraw from wallet
router.post('/withdraw', auth, csrfProtection, validateWalletWithdrawal, async (req, res) => {
  try {
    const { amount, bankAccount } = req.body;
    const user = await User.findById(req.user.id);
    
    if (user.walletBalance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Process withdrawal (integrate with payment processor)
    user.walletBalance -= amount;
    await user.save();

    res.json({ success: true, message: 'Withdrawal processed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;