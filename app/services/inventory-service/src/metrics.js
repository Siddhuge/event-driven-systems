const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const eventsProcessedTotal = new client.Counter({
  name: 'inventory_events_processed_total',
  help: 'Total inventory events processed',
  labelNames: ['status'], // success | failure | duplicate | dlq
  registers: [register]
});

const eventProcessingDuration = new client.Histogram({
  name: 'inventory_event_processing_duration_seconds',
  help: 'Duration of event processing in seconds',
  labelNames: ['status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

const retryQueueTotal = new client.Counter({
  name: 'inventory_retry_queue_total',
  help: 'Total events sent to retry queue',
  labelNames: ['retry_count'],
  registers: [register]
});

const dlqTotal = new client.Counter({
  name: 'inventory_dlq_total',
  help: 'Total events sent to dead-letter queue',
  registers: [register]
});

module.exports = { register, eventsProcessedTotal, eventProcessingDuration, retryQueueTotal, dlqTotal };
