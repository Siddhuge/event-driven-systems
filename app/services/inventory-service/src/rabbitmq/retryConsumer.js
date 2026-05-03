require('../tracing');

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const amqp = require('amqplib');
const { connectProducer, disconnectProducer, sendToTopic } = require('../kafka/producer');
const { startHealthServer, setReady } = require('../health');
const logger = require('../logger');

const startRetryWorker = async () => {
  startHealthServer(8080);

  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await conn.createChannel();

  await connectProducer();

  await channel.assertQueue('retry_processed', { durable: true });
  channel.prefetch(1);

  setReady('kafka', true);
  setReady('rabbit', true);
  setReady('redis', true); // retry-worker doesn't use Redis

  logger.info('Retry worker running');

  channel.consume('retry_processed', async (msg) => {
    if (!msg) return;

    let event;
    try {
      event = JSON.parse(msg.content.toString());
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to parse retry message, discarding');
      channel.nack(msg, false, false);
      return;
    }

    try {
      logger.info({ orderId: event.orderId, retryCount: event.retryCount }, 'Replaying event via Kafka');
      await sendToTopic('orders_retry', event);
      channel.ack(msg);
    } catch (err) {
      logger.error({ orderId: event?.orderId, error: err.message }, 'Failed to republish to Kafka, requeuing');
      // Requeue for retry — the msg will re-appear after basic.nack
      channel.nack(msg, false, true);
    }
  });

  conn.on('error', (err) => logger.error({ error: err.message }, 'RabbitMQ connection error'));

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutdown signal received');
    try {
      await channel.close();
      await conn.close();
      await disconnectProducer();
      logger.info('Retry worker shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ error: err.message }, 'Error during retry worker shutdown');
      process.exit(1);
    }
  };

  setTimeout(() => {
    logger.error('Forced exit after shutdown timeout');
    process.exit(1);
  }, 30000).unref();

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (err) => {
    logger.error({ error: err?.message }, 'Unhandled promise rejection');
    process.exit(1);
  });
};

startRetryWorker().catch((err) => {
  const pino = require('pino');
  pino().error({ error: err.message }, 'Retry worker startup failed');
  process.exit(1);
});
