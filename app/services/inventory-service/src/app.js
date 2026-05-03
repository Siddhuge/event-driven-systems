const { setReady } = require('./health');
const logger = require('./logger');

module.exports = async () => {
  const { runConsumer } = require('./consumers/orderConsumer');
  
  try {
    const stop = await runConsumer();
    setReady('kafka', true);
    logger.info('Inventory service consumer started and ready');
    return stop;
  } catch (err) {
    logger.error({ error: err.message }, 'Failed to start inventory consumer');
    throw err;
  }
};
