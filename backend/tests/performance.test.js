const request = require('supertest');
const createTestApp = require('./testApp');

describe('Performance Tests', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });

  test('health endpoint should respond quickly', async () => {
    const start = Date.now();
    const response = await request(app).get('/api/health');
    const duration = Date.now() - start;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(1000);
  });

  test('should handle multiple requests', async () => {
    const requests = Array(5).fill().map(() =>
      request(app).get('/api/health')
    );
    
    const responses = await Promise.all(requests);
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});