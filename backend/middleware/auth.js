const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    // Check if token is blacklisted
    const blacklisted = await TokenBlacklist.findOne({ token });
    if (blacklisted) {
      return res.status(401).json({ success: false, message: 'Token has been revoked.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Additional token validation
    if (!decoded.userId || !decoded.iat || !decoded.exp) {
      return res.status(401).json({ success: false, message: 'Invalid token structure.' });
    }

    // Check if token is expired (additional check beyond jwt.verify)
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp < currentTime) {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }

    // Check if user account is active/verified
    if (!user.isVerified) {
      return res.status(401).json({ success: false, message: 'Account not verified. Please verify your email.' });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      accountType: user.accountType,
      isVerified: user.isVerified
    };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }
    res.status(401).json({ success: false, message: 'Authentication failed.' });
  }
};

module.exports = { auth };