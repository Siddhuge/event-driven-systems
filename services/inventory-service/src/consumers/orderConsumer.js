const kafka = require("../kafka/kafka");
const { connectProducer, sendToTopic } = require("../kafka/producer");
const { connectRabbit, sendToRetryQueue } = require("../rabbitmq/producer");
const { isProcessed, markProcessed } = require("../utils/idempotency");

const consumer = kafka.consumer({ groupId: "inventory-group" });

const MAX_RETRIES = 3;

const runConsumer = async () => {
  await consumer.connect();
  await connectProducer();
  await connectRabbit();  // 👈 NEW

  await consumer.subscribe({ topic: "orders", fromBeginning: true });
  await consumer.subscribe({ topic: "orders_retry", fromBeginning: true });

  console.log("Inventory Consumer Running...");

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      const retryCount = event.retryCount || 0;

      console.log(`Processing ${event.orderId} (retry: ${retryCount})`);

      if (isProcessed(event.orderId)) {
        console.log("Duplicate skipped:", event.orderId);
        return;
      }

      try {
        // simulate failure
        if (Math.random() < 0.5) {
          throw new Error("Random failure");
        }

        console.log("Inventory Reserved for", event.orderId);
        markProcessed(event.orderId);

      } catch (err) {
        console.error("Processing failed:", event.orderId);

        if (retryCount < MAX_RETRIES) {
          // 🔁 NOW USING RABBITMQ
          await sendToRetryQueue({
            ...event,
            retryCount: retryCount + 1
          });

          console.log("Sent to RabbitMQ retry queue:", event.orderId);

        } else {
          // ☠️ Still use Kafka DLQ
          await sendToTopic("orders_dlq", event);

          console.log("Sent to DLQ:", event.orderId);
        }
      }
    }
  });
};

module.exports = runConsumer;