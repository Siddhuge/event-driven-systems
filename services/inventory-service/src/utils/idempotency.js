const processedOrders = new Set();

const isProcessed = (orderId) => {
  return processedOrders.has(orderId);
};

const markProcessed = (orderId) => {
  processedOrders.add(orderId);
};

module.exports = { isProcessed, markProcessed };