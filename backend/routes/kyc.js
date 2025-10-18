const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const KYC = require('../models/KYC');
const User = require('../models/User');

const router = express.Router();

// Submit KYC information
router.post('/submit', [
  auth,
  body('firstName').trim().isLength({ min: 2 }),
  body('lastName').trim().isLength({ min: 2 }),
  body('dateOfBirth').isISO8601(),
  body('nationality').isLength({ min: 2 }),
  body('address').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, dateOfBirth, nationality, address } = req.body;

    let kyc = await KYC.findOne({ userId: req.user.id });
    
    if (kyc) {
      // Update existing KYC
      kyc.personalInfo = { firstName, lastName, dateOfBirth, nationality, address };
      kyc.status = 'pending';
    } else {
      // Create new KYC
      kyc = new KYC({
        userId: req.user.id,
        personalInfo: { firstName, lastName, dateOfBirth, nationality, address }
      });
    }

    await kyc.save();

    // Update user KYC status
    await User.findByIdAndUpdate(req.user.id, { kycStatus: 'pending' });

    res.json({
      success: true,
      status: kyc.status,
      message: 'KYC information submitted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'KYC submission failed' });
  }
});

// Get KYC status
router.get('/status', auth, async (req, res) => {
  try {
    const kyc = await KYC.findOne({ userId: req.user.id });
    
    if (!kyc) {
      return res.json({
        status: 'not_started',
        limits: { dailySpending: 100, monthlySpending: 500, cardCount: 1 }
      });
    }

    res.json({
      status: kyc.status,
      level: kyc.level,
      limits: kyc.limits,
      verificationDate: kyc.verificationDate,
      rejectionReason: kyc.rejectionReason
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch KYC status' });
  }
});

// Upload document
router.post('/upload-document', [
  auth,
  body('documentType').isIn(['idDocument', 'proofOfAddress']),
  body('documentUrl').isURL()
], async (req, res) => {
  try {
    const { documentType, documentUrl } = req.body;

    const kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc) {
      return res.status(404).json({ message: 'KYC record not found' });
    }

    kyc.documents[documentType] = {
      url: documentUrl,
      verified: false
    };

    await kyc.save();

    res.json({
      success: true,
      message: 'Document uploaded successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Document upload failed' });
  }
});

// Get KYC limits based on verification level
router.get('/limits', auth, async (req, res) => {
  try {
    const kyc = await KYC.findOne({ userId: req.user.id });
    
    const defaultLimits = {
      basic: { dailySpending: 100, monthlySpending: 500, cardCount: 1 },
      enhanced: { dailySpending: 1000, monthlySpending: 5000, cardCount: 3 },
      premium: { dailySpending: 10000, monthlySpending: 50000, cardCount: 10 }
    };

    const level = kyc?.level || 'basic';
    
    res.json({
      level,
      limits: kyc?.limits || defaultLimits[level]
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch limits' });
  }
});

module.exports = router;