require('./src/tracing');
require('dotenv').config();

const logger = require('./src/logger');
const app = require('./src/app');
const { startHealthServer } = require('./src/health');

const startServer = async () => {
  startHealthServer(8080);

  const stop = await app();

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutdown signal received, starting graceful shutdown');
    try {
      await stop?.();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ error: err.message }, 'Error during shutdown');
      process.exit(1);
    }
  };

  setTimeout(() => {
    logger.error('Forced exit after shutdown timeout');
    process.exit(1);
  }, 30000).unref();

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (err) => {
    logger.error({ error: err?.message }, 'Unhandled promise rejection');
    process.exit(1);
  });
};

startServer().catch((err) => {
  logger.error({ error: err.message }, 'Failed to start inventory service');
  process.exit(1);
});
