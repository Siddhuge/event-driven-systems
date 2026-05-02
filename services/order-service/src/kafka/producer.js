// src/kafka/producer.js
const kafka = require("../config/kafka");

const producer = kafka.producer();
let connected = false;

const connectProducer = async () => {
  await producer.connect();
  connected = true;
  console.log("Kafka Producer Connected");
};

const sendEvent = async (topic, message) => {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }]
  });
};

const isProducerConnected = () => connected;

module.exports = { connectProducer, sendEvent, isProducerConnected };
