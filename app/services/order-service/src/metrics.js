const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const ordersCreatedTotal = new client.Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['status'],
  registers: [register]
});

const orderCreationDuration = new client.Histogram({
  name: 'order_creation_duration_seconds',
  help: 'Duration of order creation in seconds',
  labelNames: ['status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

const kafkaProduceErrorsTotal = new client.Counter({
  name: 'kafka_produce_errors_total',
  help: 'Total Kafka produce errors',
  registers: [register]
});

module.exports = { register, ordersCreatedTotal, orderCreationDuration, kafkaProduceErrorsTotal };
