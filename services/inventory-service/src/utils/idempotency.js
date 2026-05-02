const redis = require("../redis/redisClient");

const isProcessed = async (orderId) => {
  return await redis.get(orderId);
};

const markProcessed = async (orderId) => {
  await redis.set(orderId, "processed");
};

module.exports = { isProcessed, markProcessed };