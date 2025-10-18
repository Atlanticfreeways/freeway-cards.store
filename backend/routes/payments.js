const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GiftCard = require('../models/GiftCard');

const router = express.Router();

// Create payment intent for gift card purchase
router.post('/create-payment-intent', [
  auth,
  body('amount').isNumeric().isFloat({ min: 5, max: 1000 }),
  body('currency').optional().isIn(['usd', 'eur', 'gbp'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, currency = 'usd' } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        userId: req.user.id,
        type: 'gift_card_purchase'
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(500).json({ message: 'Payment intent creation failed' });
  }
});

// Confirm payment and create gift card
router.post('/confirm-payment', [
  auth,
  body('paymentIntentId').notEmpty(),
  body('giftCardData').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentIntentId, giftCardData } = req.body;

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment not completed' });
    }

    // Generate unique gift card code
    const code = 'FC' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();

    // Create gift card
    const giftCard = new GiftCard({
      code,
      amount: paymentIntent.amount / 100,
      balance: paymentIntent.amount / 100,
      design: giftCardData.design || 'general',
      recipientName: giftCardData.recipientName,
      recipientEmail: giftCardData.recipientEmail,
      message: giftCardData.message,
      purchasedBy: req.user.id
    });

    await giftCard.save();

    // Create transaction record
    const transaction = new Transaction({
      userId: req.user.id,
      type: 'purchase',
      amount: paymentIntent.amount / 100,
      description: `Gift card purchase - ${code}`,
      giftCardId: giftCard._id,
      paymentMethod: 'stripe',
      transactionId: paymentIntentId
    });

    await transaction.save();

    res.json({
      success: true,
      giftCard: {
        id: giftCard._id,
        code: giftCard.code,
        amount: giftCard.amount,
        recipientName: giftCard.recipientName
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Payment confirmation failed' });
  }
});

// Add funds to wallet
router.post('/add-funds', [
  auth,
  body('amount').isNumeric().isFloat({ min: 10, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      metadata: {
        userId: req.user.id,
        type: 'wallet_funding'
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(500).json({ message: 'Wallet funding failed' });
  }
});

// Confirm wallet funding
router.post('/confirm-wallet-funding', [
  auth,
  body('paymentIntentId').notEmpty()
], async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment not completed' });
    }

    const amount = paymentIntent.amount / 100;

    // Update user wallet balance
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { walletBalance: amount } },
      { new: true }
    );

    // Create transaction record
    const transaction = new Transaction({
      userId: req.user.id,
      type: 'add_funds',
      amount,
      description: 'Wallet funding via Stripe',
      paymentMethod: 'stripe',
      transactionId: paymentIntentId
    });

    await transaction.save();

    res.json({
      success: true,
      newBalance: user.walletBalance
    });
  } catch (error) {
    res.status(500).json({ message: 'Wallet funding confirmation failed' });
  }
});

module.exports = router;