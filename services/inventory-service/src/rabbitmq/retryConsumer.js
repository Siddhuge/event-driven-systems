const path = require("path");

// ✅ Load .env from correct root location
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env")
});

const amqp = require("amqplib");
const { connectProducer, sendToTopic } = require("../kafka/producer");

const startRetryWorker = async () => {
  try {
    // 🔍 Debug (remove later)
    console.log("KAFKA_BROKER:", process.env.KAFKA_BROKER);
    console.log("RABBITMQ_URL:", process.env.RABBITMQ_URL);

    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await conn.createChannel();

    await connectProducer();

    await channel.assertQueue("retry_processed", { durable: true });

    console.log("✅ Retry Worker Running...");

    channel.consume("retry_processed", async (msg) => {
      if (!msg) return;

      try {
        const event = JSON.parse(msg.content.toString());

        console.log("🔁 Retrying via Kafka:", event.orderId);

        await sendToTopic("orders_retry", event);

        channel.ack(msg);
      } catch (err) {
        console.error("❌ Error processing message:", err);
        channel.nack(msg, false, false); // discard bad message
      }
    });

  } catch (error) {
    console.error("❌ Retry Worker Startup Failed:", error);
    process.exit(1);
  }
};

startRetryWorker();