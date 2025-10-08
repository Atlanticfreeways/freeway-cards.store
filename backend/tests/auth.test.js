const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');
const app = require('../server');

jest.mock('../models/User');
jest.mock('../models/TokenBlacklist');

describe('Auth API', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/test_cardsfreeways');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test User',
        email: process.env.TEST_EMAIL || 'test@example.com',
        password: process.env.TEST_PASSWORD || 'password123',
        accountType: 'individual'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  describe('Enhanced JWT validation', () => {
    let req, res, next;

    beforeEach(() => {
      req = { header: jest.fn() };
      res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      next = jest.fn();
    });

    it('should reject blacklisted tokens', async () => {
      req.header.mockReturnValue('Bearer validtoken');
      TokenBlacklist.findOne.mockResolvedValue({ token: 'validtoken' });

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Token has been revoked.' });
    });

    it('should reject unverified users', async () => {
      const token = jwt.sign({ userId: 'user123' }, process.env.JWT_SECRET || 'test');
      req.header.mockReturnValue(`Bearer ${token}`);
      TokenBlacklist.findOne.mockResolvedValue(null);
      User.findById.mockResolvedValue({ _id: 'user123', email: 'test@test.com', isVerified: false });

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Account not verified. Please verify your email.' });
    });
  });
});
