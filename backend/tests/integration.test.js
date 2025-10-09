const request = require('supertest');
const createTestApp = require('./testApp');

describe('Integration Tests', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });

  describe('User Registration Flow', () => {
    test('should register user', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('System Health', () => {
    test('should report system health', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });
});