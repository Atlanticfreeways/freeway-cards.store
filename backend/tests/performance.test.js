const request = require('supertest');
const app = require('./testApp');

describe('Performance Tests', () => {
  test('health endpoint should respond within 100ms', async () => {
    const start = Date.now();
    const response = await request(app).get('/api/health');
    const duration = Date.now() - start;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(100);
  });

  test('should handle 50 concurrent requests', async () => {
    const requests = Array(50).fill().map(() =>
      request(app).get('/api/health')
    );
    
    const responses = await Promise.all(requests);
    const successCount = responses.filter(r => r.status === 200).length;
    
    expect(successCount).toBe(50);
  });

  test('should not leak memory during requests', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    const requests = Array(100).fill().map(() =>
      request(app).get('/api/health')
    );
    await Promise.all(requests);
    
    if (global.gc) global.gc();
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
    
    expect(memoryIncrease).toBeLessThan(50);
  });
});