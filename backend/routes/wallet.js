const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

const router = express.Router();

// Get wallet balance
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({ balance: user.walletBalance });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add funds to wallet
router.post('/add-funds', auth, [
  body('amount').isFloat({ min: 5, max: 10000 }),
  body('paymentMethod').isIn(['card', 'crypto', 'bank'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, paymentMethod } = req.body;
    const transactionId = `tx_${Date.now()}`;

    // Update user balance
    const user = await User.findById(req.userId);
    user.walletBalance += amount;
    await user.save();

    // Create transaction record
    const transaction = new Transaction({
      userId: req.userId,
      type: 'add_funds',
      amount,
      description: `Added funds via ${paymentMethod}`,
      paymentMethod,
      transactionId
    });
    await transaction.save();

    res.json({
      success: true,
      amount,
      newBalance: user.walletBalance,
      paymentMethod,
      transactionId
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get transaction history
router.get('/transactions', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;