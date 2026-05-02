const runConsumer = require("./consumers/orderConsumer");

module.exports = async () => {
  await runConsumer();
};