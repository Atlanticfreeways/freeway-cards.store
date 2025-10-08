const DOMPurify = require('isomorphic-dompurify');
const validator = require('validator');

// Sanitize HTML content
const sanitizeHtml = (html) => {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};

// Sanitize user input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return validator.escape(input.trim());
};

// Sanitize card data for frontend
const sanitizeCardData = (card) => ({
  id: sanitizeInput(card._id?.toString() || ''),
  type: sanitizeInput(card.cardType || ''),
  lastFour: card.cardNumber ? card.cardNumber.slice(-4) : '****',
  expiryDate: sanitizeInput(card.expiryDate || ''),
  balance: parseFloat(card.balance || 0),
  status: sanitizeInput(card.status || ''),
  subscriptionType: sanitizeInput(card.subscriptionType || '')
});

// Sanitize user data
const sanitizeUserData = (user) => ({
  id: sanitizeInput(user._id?.toString() || ''),
  name: sanitizeInput(user.name || ''),
  email: sanitizeInput(user.email || ''),
  accountType: sanitizeInput(user.accountType || ''),
  isVerified: Boolean(user.isVerified),
  kycStatus: sanitizeInput(user.kycStatus || ''),
  walletBalance: parseFloat(user.walletBalance || 0)
});

module.exports = {
  sanitizeHtml,
  sanitizeInput,
  sanitizeCardData,
  sanitizeUserData
};