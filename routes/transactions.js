const express = require('express');
const { auth } = require('../middleware/auth');
const { authorizeCardOwner } = require('../middleware/authorization');
const Card = require('../models/Card');
const { getBitnobCardTransactions } = require('../utils/bitnob');

const router = express.Router();

// Get user transactions
router.get('/', auth, async (req, res) => {
  try {
    const cards = await Card.find({ userId: req.user.id });
    let allTransactions = [];

    for (const card of cards) {
      try {
        const cardTransactions = await getBitnobCardTransactions(card.bitnobCardId);
        const formattedTransactions = cardTransactions.map(tx => ({
          id: tx.id,
          description: tx.description || `${card.cardType} Transaction`,
          amount: tx.amount,
          date: tx.createdAt,
          cardId: card._id,
          status: tx.status
        }));
        allTransactions = [...allTransactions, ...formattedTransactions];
      } catch (error) {
        console.error(`Error fetching transactions for card ${card._id}:`, error.message);
      }
    }

    // Sort by date (newest first)
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, transactions: allTransactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get transactions for specific card
router.get('/card/:cardId', auth, authorizeCardOwner, async (req, res) => {
  try {
    const card = req.card; // Already validated and attached by authorizeCardOwner

    const transactions = await getBitnobCardTransactions(card.bitnobCardId);

    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      description: tx.description || 'Card Transaction',
      amount: tx.amount,
      date: tx.createdAt,
      status: tx.status,
      merchant: tx.merchant
    }));

    res.json({ success: true, transactions: formattedTransactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;