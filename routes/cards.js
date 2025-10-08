const express = require('express');
const Card = require('../models/Card');
const { auth } = require('../middleware/auth');
const { authorizeCardOwner } = require('../middleware/authorization');
const { createBitnobCard, getBitnobCard, freezeBitnobCard } = require('../utils/bitnob');
const { cardLimiter } = require('../middleware/security');
const { sanitizeCardData } = require('../utils/sanitizer');
const csrfProtection = require('../middleware/csrf');
const { validateCardCreation } = require('../middleware/validation');

const router = express.Router();

// Create new card
router.post('/create', cardLimiter, auth, csrfProtection, validateCardCreation, async (req, res) => {
  try {
    const { type, subscriptionType = 'instant' } = req.body;
    const userId = req.user.id;

    // Create card with Bitnob API
    const bitnobCard = await createBitnobCard({
      currency: 'USD',
      amount: subscriptionType === 'instant' ? 1000 : 10000,
      customerDetails: {
        userId: userId
      }
    });

    const expiresAt = subscriptionType === 'instant' 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    const card = new Card({
      userId,
      bitnobCardId: bitnobCard.id,
      cardType: type,
      subscriptionType,
      cardNumber: bitnobCard.cardNumber,
      expiryDate: bitnobCard.expiryDate,
      cvv: bitnobCard.cvv,
      spendingLimit: subscriptionType === 'instant' ? 1000 : 10000,
      expiresAt
    });

    await card.save();

    res.json({ 
      success: true, 
      card: {
        id: card._id,
        type: card.cardType,
        lastFour: card.cardNumber.slice(-4),
        expiryDate: card.expiryDate,
        balance: card.balance,
        status: card.status
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user cards
router.get('/user', auth, async (req, res) => {
  try {
    const cards = await Card.find({ userId: req.user.id });
    
    const cardData = cards.map(card => sanitizeCardData(card));

    res.json({ success: true, cards: cardData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get card details
router.get('/:cardId', auth, authorizeCardOwner, async (req, res) => {
  try {
    const card = req.card; // Already validated and attached by authorizeCardOwner

    res.json({
      success: true,
      card: {
        id: card._id,
        type: card.cardType,
        cardNumber: card.cardNumber,
        expiryDate: card.expiryDate,
        cvv: card.cvv,
        balance: card.balance,
        status: card.status,
        spendingLimit: card.spendingLimit
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Freeze/Unfreeze card
router.post('/:cardId/freeze', auth, authorizeCardOwner, csrfProtection, async (req, res) => {
  try {
    const card = req.card; // Already validated and attached by authorizeCardOwner

    const newStatus = card.status === 'active' ? 'frozen' : 'active';

    // Update status with Bitnob
    await freezeBitnobCard(card.bitnobCardId, newStatus === 'frozen');

    card.status = newStatus;
    await card.save();

    res.json({ success: true, message: `Card ${newStatus}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;