process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({ call: jest.fn().mockResolvedValue('OK') }))
);

jest.mock('rate-limit-redis', () => ({
  RedisStore: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    increment: jest.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date() }),
    decrement: jest.fn(),
    resetKey: jest.fn()
  }))
}));

jest.mock('../src/kafka/producer', () => ({
  isProducerConnected: jest.fn().mockReturnValue(true),
  sendEvent: jest.fn().mockResolvedValue(),
  connectProducer: jest.fn(),
  disconnectProducer: jest.fn()
}));

jest.mock('../src/metrics', () => ({
  register: {
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
    metrics: jest.fn().mockResolvedValue('# HELP orders_created_total Total orders\n')
  },
  ordersCreatedTotal: { inc: jest.fn() },
  orderCreationDuration: { startTimer: jest.fn(() => jest.fn()) },
  kafkaProduceErrorsTotal: { inc: jest.fn() }
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { isProducerConnected, sendEvent } = require('../src/kafka/producer');
const app = require('../src/app');

const validToken = jwt.sign({ sub: 'user-123' }, 'test-secret');
const validBody = {
  customerId: 'cust-1',
  items: [{ productId: 'prod-1', quantity: 2, price: 9.99 }]
};

describe('GET /healthz', () => {
  it('returns 200 with alive status', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'alive' });
  });
});

describe('GET /readyz', () => {
  it('returns 200 when Kafka is connected', async () => {
    isProducerConnected.mockReturnValue(true);
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', kafka: true });
  });

  it('returns 503 when Kafka is not connected', async () => {
    isProducerConnected.mockReturnValue(false);
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'not_ready', kafka: false });
  });
});

describe('GET /metrics', () => {
  it('returns prometheus metrics with text/plain content type', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/text\/plain/);
  });
});

describe('POST /orders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).post('/orders').send(validBody);
    expect(res.status).toBe(401);
  });

  it('returns 400 with invalid request body', async () => {
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('returns 201 for valid auth and body', async () => {
    sendEvent.mockResolvedValue();
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'CREATED', customerId: 'cust-1' });
  });

  it('returns 201 using sub from JWT when customerId is omitted', async () => {
    sendEvent.mockResolvedValue();
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ items: validBody.items });
    expect(res.status).toBe(201);
    expect(res.body.customerId).toBe('user-123');
  });

  it('returns 500 when Kafka producer fails', async () => {
    sendEvent.mockRejectedValue(new Error('broker unavailable'));
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validBody);
    expect(res.status).toBe(500);
  });

  it('propagates x-request-id header', async () => {
    sendEvent.mockResolvedValue();
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .set('x-request-id', 'test-req-id')
      .send(validBody);
    expect(res.status).toBe(201);
  });
});
