const redis = require('../redis/redisClient');

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

const isProcessed = async (orderId) => {
  return await redis.get(orderId);
};

const markProcessed = async (orderId) => {
  await redis.set(orderId, 'processed', 'EX', IDEMPOTENCY_TTL_SECONDS);
};

module.exports = { isProcessed, markProcessed };
