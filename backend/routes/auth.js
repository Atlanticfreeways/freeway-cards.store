const express = require('express');
const { securityEventLogger } = require('../middleware/auditLogger');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');
const { sendVerificationEmail } = require('../utils/email');
const csrfProtection = require('../middleware/csrf');
const { signupValidation, loginValidation } = require('../middleware/validation');
const { sanitizeUserData } = require('../utils/sanitizer');
const { sendSuccessResponse } = require('../utils/responseUtils');
const { authLimiter } = require('../middleware/security');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Register
router.post('/signup', authLimiter, signupValidation, async (req, res) => {
  try {
    const { name, email, password, accountType } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    
    const user = new User({
      name,
      email,
      password,
      accountType,
      verificationToken
    });

    await user.save();
    await sendVerificationEmail(email, verificationToken);

    res.status(201).json({ 
      success: true, 
      message: 'User created successfully. Please verify your email.' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !await user.comparePassword(password)) {
      securityEventLogger.loginFailure(email, 'Invalid credentials', req.ip);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      securityEventLogger.loginFailure(email, 'Email not verified', req.ip);
      return res.status(401).json({ success: false, message: 'Please verify your email' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    securityEventLogger.loginSuccess(user._id, user.email, req.ip);

    sendSuccessResponse(res, {
      token,
      user: sanitizeUserData(user)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Google OAuth
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const { sub: googleId, email, name } = ticket.getPayload();
    
    let user = await User.findOne({ $or: [{ email }, { googleId }] });
    
    if (!user) {
      user = new User({
        name,
        email,
        googleId,
        accountType: 'individual',
        isVerified: true
      });
      await user.save();
    }

    const authToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    sendSuccessResponse(res, {
      token: authToken,
      user: sanitizeUserData(user)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify Email
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findOne({ email: decoded.email, verificationToken: token });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid verification token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      // Decode to get expiration
      const decoded = jwt.decode(token);
      const expiresAt = new Date(decoded.exp * 1000);

      // Add to blacklist
      await TokenBlacklist.create({ token, expiresAt });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
