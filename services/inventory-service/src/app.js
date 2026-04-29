// src/app.js
require("dotenv").config();
const runConsumer = require("./consumers/orderConsumer");

const start = async () => {
  await runConsumer();
};

start();