require('./src/tracing');
require('dotenv').config();

const logger = require('./src/logger');
const app = require('./src/app');
const { connectProducer, disconnectProducer } = require('./src/kafka/producer');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectProducer();

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Order Service started');
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutdown signal received, starting graceful shutdown');

    server.close(async () => {
      try {
        await disconnectProducer();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ error: err.message }, 'Error during shutdown');
        process.exit(1);
      }
    });

    // Force exit after 30s if server.close hangs
    setTimeout(() => {
      logger.error('Forced exit after shutdown timeout');
      process.exit(1);
    }, 30000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (err) => {
    logger.error({ error: err?.message }, 'Unhandled promise rejection');
    process.exit(1);
  });
};

startServer().catch((err) => {
  logger.error({ error: err.message }, 'Failed to start server');
  process.exit(1);
});
