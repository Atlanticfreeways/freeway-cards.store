const request = require('supertest');
const createTestApp = require('../testApp');

describe('Security Scan Tests', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });

  describe('XSS Protection', () => {
    it('should sanitize malicious script input', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: '<script>alert("xss")</script>Test User',
          email: 'test@example.com',
          password: 'password123'
        });
      
      expect(response.body.user?.name).not.toContain('<script>');
    });
  });

  describe('Rate Limiting', () => {
    it('should handle multiple requests', async () => {
      const requests = Array(3).fill().map(() => 
        request(app)
          .post('/api/auth/login')
          .send({ email: 'test@test.com', password: 'wrong' })
      );
      
      const responses = await Promise.all(requests);
      expect(responses[0].status).toBe(401);
    });
  });
});