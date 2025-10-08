const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Basic middleware for testing
app.use(cors());
app.use(express.json());

// Mock routes for testing
app.get('/api/health', (req, res) => {
  res.set('x-content-type-options', 'nosniff');
  res.set('x-frame-options', 'DENY');
  res.set('x-xss-protection', '0');
  res.json({ status: 'healthy' });
});

app.post('/api/auth/signup', (req, res) => {
  res.status(201).json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
  res.status(401).json({ success: false });
});

app.post('/api/cards/create', (req, res) => {
  res.status(403).json({ success: false });
});

module.exports = app;