const { authorizeResourceOwner, authorizeCardOwner } = require('../../middleware/authorization');
const Card = require('../../models/Card');

jest.mock('../../models/Card');
jest.mock('../../middleware/logging', () => ({ logSuspiciousActivity: jest.fn() }));

describe('Authorization Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: 'user123' }, params: {}, query: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('authorizeResourceOwner', () => {
    it('allows access when user owns resource', () => {
      req.params.userId = 'user123';
      authorizeResourceOwner('userId')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('denies access when user does not own resource', () => {
      req.params.userId = 'otherUser';
      authorizeResourceOwner('userId')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('authorizeCardOwner', () => {
    it('allows access when user owns card', async () => {
      req.params.cardId = 'card123';
      Card.findOne.mockResolvedValue({ _id: 'card123', userId: 'user123' });
      
      await authorizeCardOwner(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.card).toBeDefined();
    });

    it('denies access when card not found', async () => {
      req.params.cardId = 'card123';
      Card.findOne.mockResolvedValue(null);
      
      await authorizeCardOwner(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});