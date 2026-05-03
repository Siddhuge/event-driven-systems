const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const httpLogger = require('./middleware/requestId');
const orderRoutes = require('./routes/orderRoutes');
const { isProducerConnected } = require('./kafka/producer');
const { register } = require('./metrics');

const app = express();

app.use(helmet());
app.use(express.json());
app.use(httpLogger);

// Redis-backed distributed rate limiter (shared across replicas)
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args)
  })
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'alive' });
});

app.get('/readyz', (_req, res) => {
  if (!isProducerConnected()) {
    return res.status(503).json({ status: 'not_ready', kafka: false });
  }
  return res.status(200).json({ status: 'ready', kafka: true });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/orders', limiter, orderRoutes);

module.exports = app;
