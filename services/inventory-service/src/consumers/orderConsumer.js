const kafka = require("../kafka/kafka");
const { connectProducer, sendToTopic } = require("../kafka/producer");
const { connectRabbit, sendToRetryQueue } = require("../rabbitmq/producer");
const { isProcessed, markProcessed } = require("../utils/idempotency");

const consumer = kafka.consumer({ groupId: "inventory-group" });

const MAX_RETRIES = 3;
const PROCESSING_TIMEOUT = 5000; // 5 sec

// ✅ Safe JSON parser
const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (err) {
    console.error("❌ Invalid JSON message:", value);
    return null;
  }
};

// ✅ Simulated business logic
const processOrder = async (event) => {
  if (Math.random() < 0.5) {
    throw new Error("Random failure");
  }

  console.log("✅ Inventory Reserved for", event.orderId);
};

// ✅ Main consumer
const runConsumer = async () => {
  await consumer.connect();
  await connectProducer();
  await connectRabbit();

  await consumer.subscribe({ topic: "orders", fromBeginning: true });
  await consumer.subscribe({ topic: "orders_retry", fromBeginning: true });

  console.log("🚀 Inventory Consumer Running...");

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const raw = message.value.toString();
      const event = safeJsonParse(raw);

      if (!event) return;

      const retryCount = event.retryCount || 0;

      const context = {
        orderId: event.orderId,
        retry: retryCount,
        topic
      };

      console.log("📥 Processing:", context);

      // 🧠 HARD STOP: If retry exceeded → directly DLQ
      if (retryCount >= MAX_RETRIES) {
        const dlqEvent = {
          ...event,
          failedAt: new Date().toISOString(),
          error: "Max retries exceeded",
          sourceTopic: topic
        };

        await sendToTopic("orders_dlq", dlqEvent);

        console.log("☠️ Max retries reached → Sent to DLQ:", dlqEvent);
        return;
      }

      // 🧠 Idempotency check
      if (await isProcessed(event.orderId)) {
        console.log("⚠️ Duplicate skipped:", event.orderId);
        return;
      }

      try {
        // ⏱️ Timeout-protected processing
        await Promise.race([
          processOrder(event),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Processing timeout")), PROCESSING_TIMEOUT)
          )
        ]);

        await markProcessed(event.orderId);

        console.log("✅ Successfully processed:", context);

      } catch (err) {
        console.error("❌ Processing failed:", {
          ...context,
          error: err.message
        });

        // 🔁 Retry logic
        const retryEvent = {
          ...event,
          retryCount: retryCount + 1,
          lastFailedAt: new Date().toISOString(),
          sourceTopic: topic
        };

        await sendToRetryQueue(retryEvent);

        console.log("🔁 Sent to retry queue:", retryEvent);
      }
    }
  });
};

module.exports = runConsumer;