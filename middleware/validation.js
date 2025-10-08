const { body, validationResult } = require('express-validator');
const { sanitizeInput } = require('../utils/sanitizer');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const loginValidation = [
  body('email').isEmail().normalizeEmail().escape(),
  body('password').isLength({ min: 8 }).escape(),
  handleValidationErrors
];

const signupValidation = [
  body('name').isLength({ min: 2, max: 50 }).escape(),
  body('email').isEmail().normalizeEmail().escape(),
  body('password').isLength({ min: 8 }).escape(),
  body('accountType').isIn(['individual', 'business']).escape(),
  handleValidationErrors
];

const cardValidation = [
  body('type').isIn(['visa', 'mastercard']).escape(),
  handleValidationErrors
];

const validateCardCreation = [
  body('type').isIn(['visa', 'mastercard']).withMessage('Invalid card type').escape(),
  body('subscriptionType').optional().isIn(['instant', 'subscription']).withMessage('Invalid subscription type').escape(),
  handleValidationErrors
];

const validateWalletFunding = [
  body('cryptocurrency').isIn(['BTC', 'ETH', 'USDT']).withMessage('Unsupported cryptocurrency').escape(),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0').toFloat(),
  handleValidationErrors
];

const validateWalletWithdrawal = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0').toFloat(),
  body('bankAccount').isLength({ min: 10, max: 50 }).withMessage('Invalid bank account details').escape(),
  handleValidationErrors
];

module.exports = {
  loginValidation,
  signupValidation,
  cardValidation,
  validateCardCreation,
  validateWalletFunding,
  validateWalletWithdrawal,
  handleValidationErrors
};
