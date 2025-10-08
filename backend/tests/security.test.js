const request = require('supertest');
const app = require('../server');

describe('Security Tests', () => {
  test('should reject requests without CSRF token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    
    expect(response.status).toBe(403);
  });

  test('should sanitize XSS attempts', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        name: '<script>alert("xss")</script>',
        email: 'test@example.com',
        password: 'password123',
        accountType: 'individual'
      });
    
    expect(response.status).toBe(400);
  });

  test('should validate input properly', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'invalid-email', password: '123' });
    
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  describe('Authorization Tests', () => {
    test('should deny access to unauthorized card operations', async () => {
      const response = await request(app)
        .get('/api/cards/someCardId')
        .set('Authorization', 'Bearer invalidtoken');
      
      expect(response.status).toBe(401);
    });

    test('should deny access to other users resources', async () => {
      const response = await request(app)
        .get('/api/transactions/otherUserId')
        .set('Authorization', 'Bearer validtoken');
      
      expect(response.status).toBe(403);
    });
  });

  describe('Response Sanitization Tests', () => {
    test('should sanitize sensitive data in responses', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer validtoken');
      
      if (response.body.user) {
        expect(response.body.user.password).toBeUndefined();
      }
    });
  });
});