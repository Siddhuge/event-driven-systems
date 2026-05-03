const validate = require('../src/middleware/validate');
const { CreateOrderSchema } = require('../src/validation/orderSchema');

const mw = validate(CreateOrderSchema);

describe('validate middleware (CreateOrderSchema)', () => {
  let res, next;

  beforeEach(() => {
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it('returns 400 when body is empty', () => {
    mw({ body: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Validation failed' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when items array is empty', () => {
    mw({ body: { items: [] } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when quantity is negative', () => {
    mw({ body: { items: [{ productId: 'p1', quantity: -1, price: 10 }] } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when price is zero', () => {
    mw({ body: { items: [{ productId: 'p1', quantity: 1, price: 0 }] } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when productId is missing', () => {
    mw({ body: { items: [{ quantity: 1, price: 10 }] } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('calls next and sets req.validatedBody with valid payload', () => {
    const req = { body: { items: [{ productId: 'prod-1', quantity: 2, price: 29.99 }] } };
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.validatedBody).toEqual(req.body);
  });

  it('calls next when optional customerId is provided', () => {
    const req = {
      body: {
        customerId: 'cust-42',
        items: [{ productId: 'prod-1', quantity: 1, price: 5 }]
      }
    };
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.validatedBody.customerId).toBe('cust-42');
  });

  it('returns 400 when more than 50 items are submitted', () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      productId: `p${i}`,
      quantity: 1,
      price: 1
    }));
    mw({ body: { items } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
