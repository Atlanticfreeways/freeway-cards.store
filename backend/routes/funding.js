const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Bank transfer funding (instant)
router.post('/bank-transfer', [
  auth,
  body('amount').isNumeric().isFloat({ min: 10, max: 10000 }),
  body('bankAccount').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, bankAccount } = req.body;

    // In production: integrate with banking API (Plaid, Yodlee, etc.)
    // For now, simulate instant transfer
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { walletBalance: amount } },
      { new: true }
    );

    const transaction = new Transaction({
      userId: req.user.id,
      type: 'bank_transfer',
      amount,
      description: `Bank transfer from ${bankAccount.bankName}`,
      status: 'completed',
      paymentMethod: 'bank_transfer'
    });
    await transaction.save();

    res.json({
      success: true,
      newBalance: user.walletBalance,
      transactionId: transaction._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Bank transfer failed' });
  }
});

// Crypto funding
router.post('/crypto', [
  auth,
  body('amount').isNumeric().isFloat({ min: 10, max: 50000 }),
  body('cryptocurrency').isIn(['bitcoin', 'ethereum', 'usdc', 'usdt']),
  body('txHash').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, cryptocurrency, txHash } = req.body;

    // In production: verify crypto transaction on blockchain
    // For now, simulate verification
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { walletBalance: amount } },
      { new: true }
    );

    const transaction = new Transaction({
      userId: req.user.id,
      type: 'crypto_deposit',
      amount,
      description: `${cryptocurrency.toUpperCase()} deposit`,
      status: 'completed',
      paymentMethod: cryptocurrency,
      transactionId: txHash
    });
    await transaction.save();

    res.json({
      success: true,
      newBalance: user.walletBalance,
      transactionId: transaction._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Crypto funding failed' });
  }
});

// Get funding methods
router.get('/methods', auth, async (req, res) => {
  try {
    const methods = [
      {
        type: 'bank_transfer',
        name: 'Instant Bank Transfer',
        fee: 0,
        minAmount: 10,
        maxAmount: 10000,
        processingTime: 'Instant'
      },
      {
        type: 'crypto',
        name: 'Cryptocurrency',
        fee: 0,
        minAmount: 10,
        maxAmount: 50000,
        processingTime: '1-3 confirmations',
        supportedCoins: ['bitcoin', 'ethereum', 'usdc', 'usdt']
      }
    ];

    res.json({ methods });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch funding methods' });
  }
});

module.exports = router;