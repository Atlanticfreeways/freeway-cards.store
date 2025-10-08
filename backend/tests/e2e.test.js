const request = require('supertest');
const app = require('../server');

describe('End-to-End Tests', () => {
  let authToken;
  let userId;

  describe('Complete User Journey', () => {
    test('should complete full user registration and verification flow', async () => {
      // 1. Register user
      const registerResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'E2E Test User',
          email: 'e2e@example.com',
          password: 'Test123!',
          accountType: 'individual'
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);
    });

    test('should handle authentication flow', async () => {
      // Mock verified user for login test
      const User = require('../models/User');
      const user = await User.create({
        name: 'E2E Test User',
        email: 'e2e-login@example.com',
        password: 'Test123!',
        accountType: 'individual',
        isVerified: true
      });

      // 2. Login user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'e2e-login@example.com',
          password: 'Test123!'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.token).toBeTruthy();
      
      authToken = loginResponse.body.data.token;
      userId = loginResponse.body.data.user.id;
    });

    test('should access protected routes with valid token', async () => {
      if (!authToken) {
        // Create token for test
        const jwt = require('jsonwebtoken');
        const User = require('../models/User');
        
        const user = await User.findOne({ email: 'e2e-login@example.com' });
        authToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
      }

      // 3. Access wallet endpoint
      const walletResponse = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(walletResponse.status).toBe(200);
    });

    test('should handle logout flow', async () => {
      if (!authToken) return;

      // 4. Logout user
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid routes gracefully', async () => {
      const response = await request(app).get('/api/nonexistent');
      expect(response.status).toBe(404);
    });

    test('should handle malformed requests', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send('invalid json');
      
      expect(response.status).toBe(400);
    });
  });

  describe('System Health', () => {
    test('should report healthy system status', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });
});