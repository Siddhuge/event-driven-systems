const amqp = require('amqplib');
const logger = require('../logger');

let channel;
let connection;

const RETRY_CONFIG = {
  1: { queue: 'retry_5s', ttl: 5000 },
  2: { queue: 'retry_30s', ttl: 30000 },
  3: { queue: 'retry_2m', ttl: 120000 }
};

const connectRabbit = async () => {
  connection = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await connection.createChannel();

  for (const key in RETRY_CONFIG) {
    const { queue, ttl } = RETRY_CONFIG[key];
    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-message-ttl': ttl,
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'retry_processed'
      }
    });
  }

  await channel.assertQueue('retry_processed', { durable: true });

  connection.on('error', (err) => logger.error({ error: err.message }, 'RabbitMQ connection error'));
  connection.on('close', () => logger.warn('RabbitMQ connection closed'));

  logger.info('RabbitMQ connected');
};

const disconnectRabbit = async () => {
  try {
    await channel?.close();
    await connection?.close();
    logger.info('RabbitMQ disconnected');
  } catch (err) {
    logger.error({ error: err.message }, 'Error disconnecting RabbitMQ');
  }
};

const sendToRetryQueue = async (event) => {
  const retryCount = event.retryCount || 1;
  const config = RETRY_CONFIG[retryCount];
  if (!config) return;

  await channel.sendToQueue(config.queue, Buffer.from(JSON.stringify(event)), {
    persistent: true
  });
};

module.exports = { connectRabbit, disconnectRabbit, sendToRetryQueue };
