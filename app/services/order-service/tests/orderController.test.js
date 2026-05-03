process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/kafka/producer', () => ({
  sendEvent: jest.fn(),
  connectProducer: jest.fn(),
  disconnectProducer: jest.fn(),
  isProducerConnected: jest.fn().mockReturnValue(true)
}));

jest.mock('../src/metrics', () => ({
  ordersCreatedTotal: { inc: jest.fn() },
  orderCreationDuration: { startTimer: jest.fn(() => jest.fn()) },
  kafkaProduceErrorsTotal: { inc: jest.fn() }
}));

const { sendEvent } = require('../src/kafka/producer');
const { createOrder } = require('../src/controllers/orderController');

describe('createOrder controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      validatedBody: {
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', quantity: 2, price: 19.99 }]
      },
      user: { sub: 'user-123' },
      log: { info: jest.fn(), error: jest.fn() }
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  it('returns 201 with a well-formed order on success', async () => {
    sendEvent.mockResolvedValue();
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: expect.any(String),
        customerId: 'cust-1',
        status: 'CREATED',
        createdAt: expect.any(String),
        items: req.validatedBody.items
      })
    );
  });

  it('publishes the order event to the "orders" Kafka topic', async () => {
    sendEvent.mockResolvedValue();
    await createOrder(req, res);
    expect(sendEvent).toHaveBeenCalledWith('orders', expect.objectContaining({ status: 'CREATED' }));
  });

  it('returns 500 when Kafka producer fails', async () => {
    sendEvent.mockRejectedValue(new Error('Kafka broker unavailable'));
    await createOrder(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Order creation failed' });
  });

  it('uses req.user.sub as customerId when customerId is not provided', async () => {
    req.validatedBody = { items: req.validatedBody.items };
    sendEvent.mockResolvedValue();
    await createOrder(req, res);
    const order = res.json.mock.calls[0][0];
    expect(order.customerId).toBe('user-123');
  });

  it('generates a unique orderId for each request', async () => {
    sendEvent.mockResolvedValue();
    await createOrder(req, res);
    await createOrder(req, res);
    const [first, second] = res.json.mock.calls;
    expect(first[0].orderId).not.toBe(second[0].orderId);
  });
});
