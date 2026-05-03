const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

const authenticate = require('../src/middleware/auth');

describe('authenticate middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it('returns 401 when authorization header is missing', () => {
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with Bearer', () => {
    req.headers.authorization = 'Basic sometoken';
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with an invalid token', () => {
    req.headers.authorization = 'Bearer invalidtoken';
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with an expired token', () => {
    const token = jwt.sign({ sub: 'user-1' }, 'test-secret', { expiresIn: -1 });
    req.headers.authorization = `Bearer ${token}`;
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('calls next and sets req.user with a valid token', () => {
    const token = jwt.sign({ sub: 'user-123', role: 'customer' }, 'test-secret');
    req.headers.authorization = `Bearer ${token}`;
    authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ sub: 'user-123', role: 'customer' });
  });
});
