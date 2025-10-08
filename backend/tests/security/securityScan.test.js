const request = require('supertest');
const app = require('../testApp');

describe('Security Scan Tests', () => {
  // XSS Protection Tests
  describe('XSS Protection', () => {
    test('should sanitize malicious script input', async () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: maliciousInput,
          email: 'test@example.com',
          password: 'Test123!',
          accountType: 'individual'
        });
      
      expect(response.body.user?.name).not.toContain('<script>');
    });
  });

  // SQL Injection Tests
  describe('SQL Injection Protection', () => {
    test('should prevent SQL injection in login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: "admin@test.com' OR '1'='1",
          password: 'password'
        });
      
      expect(response.status).toBe(401);
    });
  });

  // Rate Limiting Tests
  describe('Rate Limiting', () => {
    test('should enforce auth rate limits', async () => {
      const requests = Array(6).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({ email: 'test@test.com', password: 'wrong' })
      );
      
      const responses = await Promise.all(requests);
      expect(responses[5].status).toBe(429);
    });
  });

  // CSRF Protection Tests
  describe('CSRF Protection', () => {
    test('should require CSRF token for protected routes', async () => {
      const response = await request(app)
        .post('/api/cards/create')
        .send({ type: 'visa' });
      
      expect(response.status).toBe(403);
    });
  });

  // Security Headers Tests
  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
    });
  });
});