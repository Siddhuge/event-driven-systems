const amqp = require("amqplib");

let channel;

const RETRY_CONFIG = {
  1: { queue: "retry_5s", ttl: 5000 },
  2: { queue: "retry_30s", ttl: 30000 },
  3: { queue: "retry_2m", ttl: 120000 }
};

const connectRabbit = async () => {
  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await conn.createChannel();

  // Create delay queues
  for (const key in RETRY_CONFIG) {
    const { queue, ttl } = RETRY_CONFIG[key];

    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        "x-message-ttl": ttl,
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": "retry_processed"
      }
    });
  }

  await channel.assertQueue("retry_processed", { durable: true });
};

const sendToRetryQueue = async (event) => {
  const retryCount = event.retryCount || 1;
  const config = RETRY_CONFIG[retryCount];

  if (!config) return;

  await channel.sendToQueue(
    config.queue,
    Buffer.from(JSON.stringify(event))
  );
};

module.exports = { connectRabbit, sendToRetryQueue };