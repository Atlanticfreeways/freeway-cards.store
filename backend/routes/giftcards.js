const express = require('express');
const { body, validationResult } = require('express-validator');
const GiftCard = require('../models/GiftCard');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate gift card code
const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Purchase gift card
router.post('/purchase', auth, [
  body('amount').isFloat({ min: 5, max: 1000 }),
  body('recipientName').trim().isLength({ min: 1 }),
  body('design').isIn(['general', 'birthday', 'holiday', 'business'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, recipientName, recipientEmail, message, design } = req.body;
    const fee = amount * 0.02; // 2% processing fee
    const total = amount + fee;

    const user = await User.findById(req.userId);
    if (user.walletBalance < total) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    const giftCard = new GiftCard({
      code: generateCode(),
      amount,
      balance: amount,
      design: design || 'general',
      recipientName,
      recipientEmail,
      message,
      purchasedBy: req.userId
    });

    await giftCard.save();

    // Deduct from wallet
    user.walletBalance -= total;
    await user.save();

    res.status(201).json({
      giftCard: {
        id: giftCard._id,
        code: giftCard.code,
        amount: giftCard.amount,
        recipientName: giftCard.recipientName,
        design: giftCard.design
      },
      transaction: {
        amount: -total,
        fee,
        newBalance: user.walletBalance
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's gift cards
router.get('/my-cards', auth, async (req, res) => {
  try {
    const giftCards = await GiftCard.find({ purchasedBy: req.userId })
      .sort({ createdAt: -1 });

    res.json(giftCards);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Redeem gift card
router.post('/redeem', [
  body('code').trim().isLength({ min: 1 }),
  body('amount').isFloat({ min: 0.01 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code, amount } = req.body;

    const giftCard = await GiftCard.findOne({ code, status: 'active' });
    if (!giftCard) {
      return res.status(404).json({ message: 'Invalid or expired gift card' });
    }

    if (giftCard.balance < amount) {
      return res.status(400).json({ message: 'Insufficient gift card balance' });
    }

    giftCard.balance -= amount;
    if (giftCard.balance === 0) {
      giftCard.status = 'redeemed';
    }
    await giftCard.save();

    res.json({
      success: true,
      redeemedAmount: amount,
      remainingBalance: giftCard.balance
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;