const kafka = require('../kafka/kafka');
const { connectProducer, disconnectProducer, sendToTopic } = require('../kafka/producer');
const { connectRabbit, disconnectRabbit, sendToRetryQueue } = require('../rabbitmq/producer');
const { isProcessed, markProcessed } = require('../utils/idempotency');
const { setReady } = require('../health');
const logger = require('../logger');
const {
  eventsProcessedTotal,
  eventProcessingDuration,
  retryQueueTotal,
  dlqTotal
} = require('../metrics');

const consumer = kafka.consumer({ groupId: 'inventory-group' });

const MAX_RETRIES = 3;
const PROCESSING_TIMEOUT = 5000;

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    logger.error({ raw: value }, 'Invalid JSON message received');
    return null;
  }
};

// Exported separately so tests can mock it
const processOrder = async (event) => {
  if (Math.random() < 0.5) {
    throw new Error('Random processing failure');
  }
  logger.info({ orderId: event.orderId }, 'Inventory reserved');
};

// Core handler — exported for unit testing
const handleEvent = async (event, topic, _processOrder = processOrder) => {
  const retryCount = event.retryCount || 0;
  const log = logger.child({ orderId: event.orderId, retryCount, topic });
  const timer = eventProcessingDuration.startTimer();

  log.info('Processing event');

  if (retryCount >= MAX_RETRIES) {
    const dlqEvent = {
      ...event,
      failedAt: new Date().toISOString(),
      error: 'Max retries exceeded',
      sourceTopic: topic
    };
    await sendToTopic('orders_dlq', dlqEvent);
    dlqTotal.inc();
    eventsProcessedTotal.inc({ status: 'dlq' });
    timer({ status: 'dlq' });
    log.warn('Max retries exceeded, sent to DLQ');
    return;
  }

  if (await isProcessed(event.orderId)) {
    eventsProcessedTotal.inc({ status: 'duplicate' });
    timer({ status: 'duplicate' });
    log.warn('Duplicate event skipped');
    return;
  }

  try {
    await Promise.race([
      _processOrder(event),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Processing timeout')), PROCESSING_TIMEOUT)
      )
    ]);

    await markProcessed(event.orderId);
    eventsProcessedTotal.inc({ status: 'success' });
    timer({ status: 'success' });
    log.info('Event processed successfully');
  } catch (err) {
    eventsProcessedTotal.inc({ status: 'failure' });
    timer({ status: 'failure' });
    log.error({ error: err.message }, 'Event processing failed, queuing retry');

    const retryEvent = {
      ...event,
      retryCount: retryCount + 1,
      lastFailedAt: new Date().toISOString(),
      sourceTopic: topic
    };

    await sendToRetryQueue(retryEvent);
    retryQueueTotal.inc({ retry_count: String(retryCount + 1) });
  }
};

const runConsumer = async () => {
  await consumer.connect();
  setReady('kafka', true);

  await connectProducer();
  await connectRabbit();
  setReady('rabbit', true);

  // Redis connects lazily — mark ready after first connect event
  const redis = require('../redis/redisClient');
  redis.once('connect', () => setReady('redis', true));
  await redis.connect();

  await consumer.subscribe({ topic: 'orders', fromBeginning: true });
  await consumer.subscribe({ topic: 'orders_retry', fromBeginning: true });

  logger.info('Inventory consumer running');

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = safeJsonParse(message.value.toString());
      if (!event) return;
      await handleEvent(event, topic);
    }
  });

  return async () => {
    logger.info('Stopping inventory consumer');
    await consumer.disconnect();
    setReady('kafka', false);
    await disconnectRabbit();
    setReady('rabbit', false);
    await disconnectProducer();
  };
};

module.exports = { runConsumer, handleEvent, processOrder };
