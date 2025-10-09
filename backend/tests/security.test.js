const request = require('supertest');
const createTestApp = require('./testApp');

describe('Security Tests', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });

  test('should handle login attempts', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    
    expect(response.status).toBe(401);
  });

  test('should handle signup requests', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        name: '<script>alert("xss")</script>',
        email: 'test@example.com',
        password: 'password123'
      });
    
    expect(response.status).toBe(201);
  });
});