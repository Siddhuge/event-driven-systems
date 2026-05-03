const Redis = require('ioredis');
const logger = require('../logger');

const redis = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error({ error: err.message }, 'Redis error'));
redis.on('reconnecting', () => logger.warn('Redis reconnecting'));

module.exports = redis;
