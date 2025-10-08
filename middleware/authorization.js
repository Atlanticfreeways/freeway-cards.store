const { logSuspiciousActivity } = require('./logging');
const Card = require('../models/Card');

/**
 * Middleware to authorize resource ownership
 * @param {string} userIdField - The field name containing the user ID in the request params/query
 */
const authorizeResourceOwner = (userIdField = 'userId') => {
  return (req, res, next) => {
    const resourceUserId = req.params[userIdField] || req.query[userIdField];
    const authenticatedUserId = req.user?.id;

    if (!authenticatedUserId) {
      logSuspiciousActivity(req, 'Attempted access without authentication');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // If resourceUserId is provided in params/query, check ownership
    if (resourceUserId && resourceUserId !== authenticatedUserId) {
      logSuspiciousActivity(req, `Attempted unauthorized access to resource owned by ${resourceUserId}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not own this resource'
      });
    }

    next();
  };
};

/**
 * Middleware to authorize card ownership
 * Checks if the authenticated user owns the card specified by cardId param
 */
const authorizeCardOwner = async (req, res, next) => {
  try {
    const cardId = req.params.cardId;
    const authenticatedUserId = req.user?.id;

    if (!authenticatedUserId) {
      logSuspiciousActivity(req, 'Attempted access without authentication');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!cardId) {
      return res.status(400).json({
        success: false,
        message: 'Card ID is required'
      });
    }

    const card = await Card.findOne({ _id: cardId, userId: authenticatedUserId });
    if (!card) {
      logSuspiciousActivity(req, `Attempted access to non-existent or unauthorized card ${cardId}`);
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    // Attach card to request for use in route handlers
    req.card = card;
    next();
  } catch (error) {
    logSuspiciousActivity(req, `Error during card authorization: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

/**
 * Middleware to check if user account is active
 */
const requireActiveAccount = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Add additional account status checks here if needed
  // For now, just ensure user exists and is verified
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Account not verified'
    });
  }

  next();
};

module.exports = {
  authorizeResourceOwner,
  authorizeCardOwner,
  requireActiveAccount
};
