const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const VirtualCard = require('../models/VirtualCard');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const KYC = require('../models/KYC');
const cardIssuer = require('../services/cardIssuer'); // Legacy mock service
const productionCardService = require('../services/productionCardService');
const cardIssuerConfig = require('../config/cardIssuer');

const router = express.Router();

// Create virtual card
router.post('/create', [
  auth,
  body('cardName').trim().isLength({ min: 1, max: 50 }),
  body('cardType').isIn(['mastercard', 'visa']),
  body('spendingLimits.daily').optional().isNumeric().isFloat({ min: 1, max: 10000 }),
  body('spendingLimits.monthly').optional().isNumeric().isFloat({ min: 1, max: 50000 }),
  body('spendingLimits.perTransaction').optional().isNumeric().isFloat({ min: 1, max: 5000 }),
  body('merchantCategories').optional().isArray(),
  // Legacy support
  body('spendingLimit').optional().isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { 
      cardName, 
      cardType, 
      spendingLimits,
      merchantCategories = ['all'],
      // Legacy support
      spendingLimit 
    } = req.body;

    // Prepare card data
    const cardData = {
      cardName,
      cardType,
      spendingLimits: spendingLimits || {
        daily: spendingLimit || 1000,
        monthly: (spendingLimit || 1000) * 5,
        perTransaction: spendingLimit || 500
      },
      merchantCategories
    };

    // Check if we should use production card service or legacy mock
    const useRealCards = cardIssuerConfig.featureFlags.useRealCards;
    
    let cardResult;
    
    if (useRealCards) {
      // Use production card service with real card issuer integration
      cardResult = await productionCardService.createVirtualCard(req.user.id, cardData);
      
      res.status(201).json({
        success: true,
        message: 'Virtual card created successfully',
        card: cardResult,
        provider: cardIssuerConfig.defaultProvider
      });
      
    } else {
      // Use legacy mock service for backward compatibility
      const kyc = await KYC.findOne({ userId: req.user.id });
      const userCards = await VirtualCard.countDocuments({ userId: req.user.id });
      const maxCards = kyc?.limits?.cardCount || 1;
      
      if (userCards >= maxCards) {
        return res.status(400).json({ 
          success: false,
          message: 'Card limit exceeded. Complete KYC for more cards.' 
        });
      }

      // Create card via legacy issuer service
      const cardDetails = await cardIssuer.createVirtualCard(req.user.id, {
        cardName,
        cardType,
        spendingLimit: cardData.spendingLimits.daily
      });

      const virtualCard = new VirtualCard({
        userId: req.user.id,
        cardNumber: cardDetails.cardNumber,
        expiryMonth: cardDetails.expiryMonth,
        expiryYear: cardDetails.expiryYear,
        cvv: cardDetails.cvv,
        cardType,
        cardName,
        spendingLimit: cardData.spendingLimits.daily,
        spendingLimits: cardData.spendingLimits,
        merchantCategories,
        externalCardId: cardDetails.externalCardId,
        issuerProvider: 'mock'
      });

      await virtualCard.save();

      res.status(201).json({
        success: true,
        message: 'Virtual card created successfully (demo mode)',
        card: {
          id: virtualCard._id,
          cardName: virtualCard.cardName,
          cardType: virtualCard.cardType,
          lastFour: cardDetails.cardNumber.slice(-4),
          last4Digits: cardDetails.cardNumber.slice(-4),
          balance: virtualCard.balance,
          spendingLimit: virtualCard.spendingLimit,
          spendingLimits: virtualCard.spendingLimits,
          status: virtualCard.status,
          maskedCardNumber: maskCardNumber(cardDetails.cardNumber),
          createdAt: virtualCard.createdAt
        },
        provider: 'mock'
      });
    }

  } catch (error) {
    console.error('Card creation error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Card creation failed',
      provider: cardIssuerConfig.defaultProvider
    });
  }
});

// Get user cards
router.get('/', auth, async (req, res) => {
  try {
    const cards = await VirtualCard.find({ userId: req.user.id })
      .select('-cardNumber -cvv -externalCardId')
      .sort({ createdAt: -1 });

    res.json({ cards });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch cards' });
  }
});

// Get card details
router.get('/:cardId', auth, async (req, res) => {
  try {
    const card = await VirtualCard.findOne({
      _id: req.params.cardId,
      userId: req.user.id
    });

    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }

    res.json({
      card: {
        id: card._id,
        cardNumber: maskCardNumber(card.cardNumber),
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        cvv: card.cvv,
        cardName: card.cardName,
        cardType: card.cardType,
        balance: card.balance,
        spendingLimit: card.spendingLimit,
        status: card.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch card details' });
  }
});

// Fund card
router.post('/:cardId/fund', [
  auth,
  body('amount').isNumeric().isFloat({ min: 1, max: 5000 })
], async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.user.id);

    if (user.walletBalance < amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    const card = await VirtualCard.findOneAndUpdate(
      { _id: req.params.cardId, userId: req.user.id },
      { $inc: { balance: amount } },
      { new: true }
    );

    await User.findByIdAndUpdate(req.user.id, {
      $inc: { walletBalance: -amount }
    });

    // Create transaction
    const transaction = new Transaction({
      userId: req.user.id,
      type: 'card_funding',
      amount,
      description: `Funded ${card.cardName}`,
      cardId: card._id
    });
    await transaction.save();

    res.json({
      success: true,
      newCardBalance: card.balance,
      newWalletBalance: user.walletBalance - amount
    });
  } catch (error) {
    res.status(500).json({ message: 'Card funding failed' });
  }
});

// Freeze/unfreeze card
router.patch('/:cardId/status', [
  auth,
  body('status').isIn(['active', 'frozen']),
  body('reason').optional().trim().isLength({ max: 200 })
], async (req, res) => {
  try {
    const { status, reason = 'User request' } = req.body;
    const { cardId } = req.params;

    // Verify card ownership
    const card = await VirtualCard.findOne({
      _id: cardId,
      userId: req.user.id
    });

    if (!card) {
      return res.status(404).json({ 
        success: false,
        message: 'Card not found' 
      });
    }

    const useRealCards = cardIssuerConfig.featureFlags.useRealCards;
    let result;

    if (useRealCards && card.issuerProvider !== 'mock') {
      // Use production card service
      if (status === 'frozen') {
        result = await productionCardService.freezeCard(cardId, reason);
      } else if (status === 'active') {
        result = await productionCardService.unfreezeCard(cardId, reason);
      }
    } else {
      // Use legacy approach for mock cards
      card.status = status;
      card.statusReason = reason;
      await card.save();
      
      result = {
        success: true,
        cardId: card._id,
        status: card.status,
        reason: reason
      };
    }

    res.json({
      success: true,
      message: `Card ${status === 'frozen' ? 'frozen' : 'activated'} successfully`,
      card: {
        id: result.cardId,
        status: result.status,
        reason: result.reason,
        updatedAt: result.frozenAt || result.unfrozenAt || new Date()
      }
    });

  } catch (error) {
    console.error('Card status update error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Status update failed' 
    });
  }
});

// Update spending limits
router.patch('/:cardId/limits', [
  auth,
  body('spendingLimits.daily').optional().isNumeric().isFloat({ min: 1, max: 10000 }),
  body('spendingLimits.monthly').optional().isNumeric().isFloat({ min: 1, max: 50000 }),
  body('spendingLimits.perTransaction').optional().isNumeric().isFloat({ min: 1, max: 5000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { spendingLimits } = req.body;
    const { cardId } = req.params;

    // Verify card ownership
    const card = await VirtualCard.findOne({
      _id: cardId,
      userId: req.user.id
    });

    if (!card) {
      return res.status(404).json({ 
        success: false,
        message: 'Card not found' 
      });
    }

    const useRealCards = cardIssuerConfig.featureFlags.useRealCards;
    let result;

    if (useRealCards && card.issuerProvider !== 'mock') {
      // Use production card service
      result = await productionCardService.updateSpendingLimits(cardId, spendingLimits);
    } else {
      // Use legacy approach for mock cards
      card.updateSpendingLimits(spendingLimits);
      await card.save();
      
      result = {
        success: true,
        cardId: card._id,
        spendingLimits: card.spendingLimits
      };
    }

    res.json({
      success: true,
      message: 'Spending limits updated successfully',
      card: {
        id: result.cardId,
        spendingLimits: result.spendingLimits,
        updatedAt: result.updatedAt || new Date()
      }
    });

  } catch (error) {
    console.error('Spending limits update error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Spending limits update failed' 
    });
  }
});

// Get card transaction history
router.get('/:cardId/transactions', auth, async (req, res) => {
  try {
    const { cardId } = req.params;
    const { limit = 50, offset = 0, startDate, endDate } = req.query;

    // Verify card ownership
    const card = await VirtualCard.findOne({
      _id: cardId,
      userId: req.user.id
    });

    if (!card) {
      return res.status(404).json({ 
        success: false,
        message: 'Card not found' 
      });
    }

    const useRealCards = cardIssuerConfig.featureFlags.useRealCards;
    let transactions = [];

    if (useRealCards && card.issuerProvider !== 'mock') {
      // Get transactions from production card service
      const filters = {
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
      
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      
      transactions = await productionCardService.getTransactionHistory(cardId, filters);
    } else {
      // Get transactions from local database for mock cards
      transactions = await Transaction.find({
        cardId: cardId,
        userId: req.user.id
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    }

    res.json({
      success: true,
      transactions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: transactions.length
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to fetch transactions' 
    });
  }
});

// Activate a pending card
router.post('/:cardId/activate', auth, async (req, res) => {
  try {
    const { cardId } = req.params;

    // Verify card ownership
    const card = await VirtualCard.findOne({
      _id: cardId,
      userId: req.user.id
    });

    if (!card) {
      return res.status(404).json({ 
        success: false,
        message: 'Card not found' 
      });
    }

    if (card.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Card is already ${card.status}`
      });
    }

    const useRealCards = cardIssuerConfig.featureFlags.useRealCards;
    let result;

    if (useRealCards && card.issuerProvider !== 'mock') {
      // Use production card service
      result = await productionCardService.activateCard(cardId);
    } else {
      // Use legacy approach for mock cards
      card.status = 'active';
      card.statusReason = 'Activated by user';
      await card.save();
      
      result = {
        success: true,
        cardId: card._id,
        status: card.status
      };
    }

    res.json({
      success: true,
      message: 'Card activated successfully',
      card: {
        id: result.cardId,
        status: result.status,
        activatedAt: result.activatedAt || new Date()
      }
    });

  } catch (error) {
    console.error('Card activation error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Card activation failed' 
    });
  }
});

// Get card spending summary
router.get('/:cardId/spending-summary', auth, async (req, res) => {
  try {
    const { cardId } = req.params;
    const { days = 30 } = req.query;

    // Verify card ownership
    const card = await VirtualCard.findOne({
      _id: cardId,
      userId: req.user.id
    });

    if (!card) {
      return res.status(404).json({ 
        success: false,
        message: 'Card not found' 
      });
    }

    // Get spending summary
    const summary = await Transaction.getCardTransactionSummary(cardId, parseInt(days));
    const dailySpending = await Transaction.getDailySpending(cardId);

    const spendingSummary = summary.length > 0 ? summary[0] : {
      totalAmount: 0,
      transactionCount: 0,
      avgAmount: 0,
      maxAmount: 0
    };

    const dailySpent = dailySpending.length > 0 ? dailySpending[0].totalSpent : 0;

    res.json({
      success: true,
      summary: {
        period: `${days} days`,
        totalSpent: spendingSummary.totalAmount,
        transactionCount: spendingSummary.transactionCount,
        averageTransaction: spendingSummary.avgAmount,
        largestTransaction: spendingSummary.maxAmount,
        todaySpent: dailySpent,
        spendingLimits: card.spendingLimits,
        remainingLimits: {
          daily: Math.max(0, card.spendingLimits.daily - dailySpent),
          monthly: Math.max(0, card.spendingLimits.monthly - spendingSummary.totalAmount)
        }
      }
    });

  } catch (error) {
    console.error('Spending summary error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to get spending summary' 
    });
  }
});

// Replace/reissue card
router.post('/:cardId/replace', [
  auth,
  body('reason').trim().isLength({ min: 1, max: 200 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { cardId } = req.params;
    const { reason } = req.body;

    // Verify card ownership
    const oldCard = await VirtualCard.findOne({
      _id: cardId,
      userId: req.user.id
    });

    if (!oldCard) {
      return res.status(404).json({ 
        success: false,
        message: 'Card not found' 
      });
    }

    // Close the old card
    oldCard.status = 'closed';
    oldCard.statusReason = `Replaced: ${reason}`;
    await oldCard.save();

    // Create new card with same settings
    const newCardData = {
      cardName: `${oldCard.cardName} (Replacement)`,
      cardType: oldCard.cardType,
      spendingLimits: oldCard.spendingLimits,
      merchantCategories: oldCard.merchantCategories
    };

    const useRealCards = cardIssuerConfig.featureFlags.useRealCards;
    let newCard;

    if (useRealCards) {
      newCard = await productionCardService.createVirtualCard(req.user.id, newCardData);
    } else {
      // Use legacy mock service
      const cardDetails = await cardIssuer.createVirtualCard(req.user.id, {
        cardName: newCardData.cardName,
        cardType: newCardData.cardType,
        spendingLimit: newCardData.spendingLimits.daily
      });

      const virtualCard = new VirtualCard({
        userId: req.user.id,
        cardNumber: cardDetails.cardNumber,
        expiryMonth: cardDetails.expiryMonth,
        expiryYear: cardDetails.expiryYear,
        cvv: cardDetails.cvv,
        cardType: newCardData.cardType,
        cardName: newCardData.cardName,
        spendingLimits: newCardData.spendingLimits,
        merchantCategories: newCardData.merchantCategories,
        externalCardId: cardDetails.externalCardId,
        issuerProvider: 'mock'
      });

      await virtualCard.save();

      newCard = {
        cardId: virtualCard._id,
        cardName: virtualCard.cardName,
        cardType: virtualCard.cardType,
        last4Digits: cardDetails.cardNumber.slice(-4),
        status: virtualCard.status,
        createdAt: virtualCard.createdAt
      };
    }

    res.json({
      success: true,
      message: 'Card replaced successfully',
      oldCard: {
        id: oldCard._id,
        status: oldCard.status,
        closedAt: new Date()
      },
      newCard: newCard
    });

  } catch (error) {
    console.error('Card replacement error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Card replacement failed' 
    });
  }
});

// Get card fraud analysis
router.get('/:cardId/fraud-analysis', auth, async (req, res) => {
  try {
    const { cardId } = req.params;

    // Verify card ownership
    const card = await VirtualCard.findOne({
      _id: cardId,
      userId: req.user.id
    });

    if (!card) {
      return res.status(404).json({ 
        success: false,
        message: 'Card not found' 
      });
    }

    const fraudDetectionService = require('../services/fraudDetectionService');
    const stats = await fraudDetectionService.getFraudStats(cardId);

    res.json({
      success: true,
      card: {
        id: card._id,
        complianceFlags: card.complianceFlags || [],
        riskLevel: card.complianceFlags?.includes('high_risk') ? 'high' : 
                  card.complianceFlags?.includes('fraud_alert') ? 'medium' : 'low'
      },
      fraudStats: stats,
      lastAnalyzed: new Date()
    });

  } catch (error) {
    console.error('Fraud analysis error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to get fraud analysis' 
    });
  }
});

// Clear fraud flags (admin or user request)
router.post('/:cardId/clear-fraud-flags', [
  auth,
  body('reason').trim().isLength({ min: 1, max: 200 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { cardId } = req.params;
    const { reason } = req.body;

    // Verify card ownership
    const card = await VirtualCard.findOne({
      _id: cardId,
      userId: req.user.id
    });

    if (!card) {
      return res.status(404).json({ 
        success: false,
        message: 'Card not found' 
      });
    }

    // Clear fraud-related compliance flags
    const fraudFlags = ['fraud_alert', 'high_risk', 'manual_review'];
    const clearedFlags = [];

    fraudFlags.forEach(flag => {
      if (card.complianceFlags && card.complianceFlags.includes(flag)) {
        card.removeComplianceFlag(flag);
        clearedFlags.push(flag);
      }
    });

    // If card was frozen due to fraud, unfreeze it
    if (card.status === 'frozen' && card.statusReason?.includes('fraud')) {
      card.updateStatus('active', `Fraud flags cleared: ${reason}`);
    }

    await card.save();

    res.json({
      success: true,
      message: 'Fraud flags cleared successfully',
      clearedFlags,
      card: {
        id: card._id,
        status: card.status,
        complianceFlags: card.complianceFlags || [],
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Clear fraud flags error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to clear fraud flags' 
    });
  }
});

// Get card issuer configuration status
router.get('/config/status', auth, async (req, res) => {
  try {
    const status = cardIssuerConfig.getStatus();
    
    res.json({
      success: true,
      config: {
        defaultProvider: status.defaultProvider,
        useRealCards: status.featureFlags.useRealCards,
        enableWebhooks: status.featureFlags.enableWebhooks,
        enableFraudDetection: status.featureFlags.enableFraudDetection,
        availableProviders: status.providers,
        environment: status.environment
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to get configuration status' 
    });
  }
});

// Helper functions
function generateCardNumber(cardType) {
  const prefix = cardType === 'visa' ? '4' : '5';
  return prefix + Math.random().toString().slice(2, 16);
}

function generateExpiryDate() {
  const now = new Date();
  const year = (now.getFullYear() + 3).toString().slice(-2);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  return { month, year };
}

function generateCVV() {
  return Math.floor(Math.random() * 900 + 100).toString();
}

function maskCardNumber(cardNumber) {
  return '**** **** **** ' + cardNumber.slice(-4);
}

module.exports = router;