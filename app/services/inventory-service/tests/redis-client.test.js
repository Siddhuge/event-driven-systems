jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({ on: jest.fn() }))
);
jest.mock('../src/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

describe('Redis client', () => {
  let redis;

  beforeAll(() => {
    redis = require('../src/redis/redisClient');
  });

  it('creates an ioredis instance with lazyConnect and maxRetriesPerRequest', () => {
    const IoRedis = require('ioredis');
    expect(IoRedis).toHaveBeenCalledWith(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3
    });
  });

  it('registers connect, error, and reconnecting event handlers', () => {
    const events = redis.on.mock.calls.map(([e]) => e);
    expect(events).toContain('connect');
    expect(events).toContain('error');
    expect(events).toContain('reconnecting');
  });

  it('connect handler calls logger.info', () => {
    const logger = require('../src/logger');
    const connectCb = redis.on.mock.calls.find(([e]) => e === 'connect')[1];
    connectCb();
    expect(logger.info).toHaveBeenCalled();
  });

  it('error handler calls logger.error', () => {
    const logger = require('../src/logger');
    const errorCb = redis.on.mock.calls.find(([e]) => e === 'error')[1];
    errorCb(new Error('redis error'));
    expect(logger.error).toHaveBeenCalled();
  });

  it('reconnecting handler calls logger.warn', () => {
    const logger = require('../src/logger');
    const reconnectCb = redis.on.mock.calls.find(([e]) => e === 'reconnecting')[1];
    reconnectCb();
    expect(logger.warn).toHaveBeenCalled();
  });
});
