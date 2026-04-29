// src/config/kafka.js
const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: process.env.CLIENT_ID,
  brokers: [process.env.KAFKA_BROKER]
});

module.exports = kafka;