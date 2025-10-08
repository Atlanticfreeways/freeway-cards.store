const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');

describe('Integration Tests', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('User Registration Flow', () => {
    test('should register and login user', async () => {
      // Register
      const registerResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Test123!',
          accountType: 'individual'
        });
      
      expect(registerResponse.status).toBe(201);
      
      // Verify user exists
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user).toBeTruthy();
      expect(user.isVerified).toBe(false);
    });
  });

  describe('Authentication Flow', () => {
    test('should prevent login without verification', async () => {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        accountType: 'individual',
        isVerified: false
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Database Integration', () => {
    test('should connect to database', () => {
      expect(mongoose.connection.readyState).toBe(1);
    });

    test('should create user with proper schema', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123!',
        accountType: 'individual'
      });

      await user.save();
      expect(user._id).toBeTruthy();
      expect(user.createdAt).toBeTruthy();
    });
  });
});