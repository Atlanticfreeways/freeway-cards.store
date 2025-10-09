const express = require('express');
const cors = require('cors');

function createTestApp() {
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy' });
  });
  
  app.post('/api/auth/signup', (req, res) => {
    res.status(201).json({ success: true, user: { name: 'Test User' } });
  });
  
  app.post('/api/auth/login', (req, res) => {
    res.status(401).json({ success: false, message: 'Invalid token structure.' });
  });
  
  app.get('/api/nonexistent', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  
  return app;
}

module.exports = createTestApp;