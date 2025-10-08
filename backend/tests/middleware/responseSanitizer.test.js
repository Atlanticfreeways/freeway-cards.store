const { sanitizeResponse, sanitizeResponseData } = require('../../middleware/responseSanitizer');

jest.mock('../../utils/sanitizer', () => ({
  sanitizeInput: jest.fn(input => input.replace(/<script>.*?<\/script>/g, '').replace(/<script>/g, '')),
  sanitizeCardData: jest.fn(data => ({ ...data, cardNumber: '****' })),
  sanitizeUserData: jest.fn(data => ({ ...data, password: undefined }))
}));

describe('Response Sanitizer', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = { json: jest.fn() };
    next = jest.fn();
  });

  describe('sanitizeResponse middleware', () => {
    it('sanitizes response data', () => {
      sanitizeResponse(req, res, next);
      
      const testData = { message: '<script>alert("xss")</script>' };
      res.json(testData);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('sanitizeResponseData', () => {
    it('sanitizes string values', () => {
      const result = sanitizeResponseData('<script>alert("xss")</script>');
      expect(result).toBe('');
    });

    it('sanitizes nested objects', () => {
      const data = { user: { name: 'test', password: 'secret' } };
      const result = sanitizeResponseData(data);
      expect(result.user.password).toBeUndefined();
    });

    it('sanitizes arrays', () => {
      const data = { cards: [{ cardNumber: '1234' }] };
      const result = sanitizeResponseData(data);
      expect(result.cards[0].cardNumber).toBe('****');
    });
  });
});