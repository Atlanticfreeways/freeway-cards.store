const request = require('supertest');
const createTestApp = require('./testApp');

describe('End-to-End Tests', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });

  describe('Complete User Journey', () => {
    it('should complete basic API flow', async () => {
      const registerResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'E2E Test User',
          email: 'e2e@example.com',
          password: 'password123'
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);
    });

    it('should handle authentication flow', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'e2e@example.com',
          password: 'password123'
        });

      expect(loginResponse.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid routes gracefully', async () => {
      const response = await request(app).get('/api/nonexistent');
      expect(response.status).toBe(404);
    });
  });

  describe('System Health', () => {
    it('should report healthy system status', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });
});