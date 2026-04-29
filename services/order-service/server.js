// server.js
require("dotenv").config();
const app = require("./src/app");
const { connectProducer } = require("./src/kafka/producer");

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectProducer();

  app.listen(PORT, () => {
    console.log(`Order Service running on port ${PORT}`);
  });
};

startServer();