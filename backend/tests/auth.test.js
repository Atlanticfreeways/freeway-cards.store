const request = require('supertest');
const createTestApp = require('./testApp');

describe('Auth API', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });

  it('should register a new user', async () => {
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

  it('should handle login attempts', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Invalid token structure.');
  });
});