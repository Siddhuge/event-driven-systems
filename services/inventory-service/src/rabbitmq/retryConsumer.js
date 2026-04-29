const amqp = require("amqplib");
const { sendToTopic, connectProducer } = require("../kafka/producer");

const startRetryWorker = async () => {
  const conn = await amqp.connect("amqp://localhost");
  const channel = await conn.createChannel();

  await connectProducer();  // 👈 FIX

  await channel.assertQueue("retry_processed", { durable: true });

  console.log("Retry Worker Running...");

  channel.consume("retry_processed", async (msg) => {
    const event = JSON.parse(msg.content.toString());

    console.log("Retrying via Kafka:", event.orderId);

    await sendToTopic("orders_retry", event);

    channel.ack(msg);
  });
};

startRetryWorker();