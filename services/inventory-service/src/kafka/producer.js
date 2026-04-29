const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "inventory-service",
  brokers: ["localhost:9092"]
});

const producer = kafka.producer();

const connectProducer = async () => {
  await producer.connect();
};

const sendToTopic = async (topic, message) => {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }]
  });
};

module.exports = { connectProducer, sendToTopic };