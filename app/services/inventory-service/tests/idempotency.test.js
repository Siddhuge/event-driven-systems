jest.mock('../src/redis/redisClient', () => ({
  get: jest.fn(),
  set: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  connect: jest.fn()
}));

jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  child: jest.fn().mockReturnThis()
}));

const redis = require('../src/redis/redisClient');
const { isProcessed, markProcessed } = require('../src/utils/idempotency');

describe('idempotency', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('isProcessed', () => {
    it('returns null for an order that has not been processed', async () => {
      redis.get.mockResolvedValue(null);
      const result = await isProcessed('order-abc');
      expect(result).toBeNull();
      expect(redis.get).toHaveBeenCalledWith('order-abc');
    });

    it('returns "processed" for an order that has already been processed', async () => {
      redis.get.mockResolvedValue('processed');
      const result = await isProcessed('order-abc');
      expect(result).toBe('processed');
    });
  });

  describe('markProcessed', () => {
    it('sets the orderId with a 24-hour TTL', async () => {
      redis.set.mockResolvedValue('OK');
      await markProcessed('order-xyz');
      expect(redis.set).toHaveBeenCalledWith('order-xyz', 'processed', 'EX', 86400);
    });

    it('propagates Redis errors', async () => {
      redis.set.mockRejectedValue(new Error('Redis connection lost'));
      await expect(markProcessed('order-xyz')).rejects.toThrow('Redis connection lost');
    });
  });
});
