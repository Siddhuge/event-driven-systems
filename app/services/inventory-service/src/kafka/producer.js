const kafka = require('./kafka');
const logger = require('../logger');

const producer = kafka.producer();
let connected = false;

const connectProducer = async () => {
  await producer.connect();
  connected = true;
  logger.info('Kafka producer connected');
};

const disconnectProducer = async () => {
  await producer.disconnect();
  connected = false;
  logger.info('Kafka producer disconnected');
};

const sendToTopic = async (topic, message) => {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }]
  });
};

const isProducerConnected = () => connected;

module.exports = { connectProducer, disconnectProducer, sendToTopic, isProducerConnected };
