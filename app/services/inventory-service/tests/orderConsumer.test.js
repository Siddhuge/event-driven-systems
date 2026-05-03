jest.mock('../src/kafka/producer', () => ({
  connectProducer: jest.fn(),
  disconnectProducer: jest.fn(),
  sendToTopic: jest.fn(),
  isProducerConnected: jest.fn().mockReturnValue(true)
}));

jest.mock('../src/rabbitmq/producer', () => ({
  connectRabbit: jest.fn(),
  disconnectRabbit: jest.fn(),
  sendToRetryQueue: jest.fn()
}));

jest.mock('../src/utils/idempotency', () => ({
  isProcessed: jest.fn(),
  markProcessed: jest.fn()
}));

jest.mock('../src/health', () => ({
  startHealthServer: jest.fn(),
  setReady: jest.fn()
}));

jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  child: jest.fn().mockReturnThis()
}));

jest.mock('../src/metrics', () => ({
  eventsProcessedTotal: { inc: jest.fn() },
  eventProcessingDuration: { startTimer: jest.fn(() => jest.fn()) },
  retryQueueTotal: { inc: jest.fn() },
  dlqTotal: { inc: jest.fn() }
}));

const { sendToTopic } = require('../src/kafka/producer');
const { sendToRetryQueue } = require('../src/rabbitmq/producer');
const { isProcessed, markProcessed } = require('../src/utils/idempotency');
const { handleEvent } = require('../src/consumers/orderConsumer');

const baseEvent = { orderId: 'order-001', items: [{ productId: 'p1', quantity: 1, price: 10 }] };

describe('handleEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('DLQ routing', () => {
    it('sends to DLQ when retryCount equals MAX_RETRIES (3)', async () => {
      sendToTopic.mockResolvedValue();
      await handleEvent({ ...baseEvent, retryCount: 3 }, 'orders_retry');
      expect(sendToTopic).toHaveBeenCalledWith('orders_dlq', expect.objectContaining({
        orderId: 'order-001',
        error: 'Max retries exceeded'
      }));
      expect(sendToRetryQueue).not.toHaveBeenCalled();
    });

    it('sends to DLQ when retryCount exceeds MAX_RETRIES', async () => {
      sendToTopic.mockResolvedValue();
      await handleEvent({ ...baseEvent, retryCount: 5 }, 'orders_retry');
      expect(sendToTopic).toHaveBeenCalledWith('orders_dlq', expect.anything());
    });

    it('includes failedAt and sourceTopic in DLQ event', async () => {
      sendToTopic.mockResolvedValue();
      await handleEvent({ ...baseEvent, retryCount: 3 }, 'orders_retry');
      const dlqEvent = sendToTopic.mock.calls[0][1];
      expect(dlqEvent).toHaveProperty('failedAt');
      expect(dlqEvent).toHaveProperty('sourceTopic', 'orders_retry');
    });
  });

  describe('idempotency', () => {
    it('skips processing for a duplicate event', async () => {
      isProcessed.mockResolvedValue('processed');
      await handleEvent({ ...baseEvent, retryCount: 0 }, 'orders');
      expect(markProcessed).not.toHaveBeenCalled();
      expect(sendToRetryQueue).not.toHaveBeenCalled();
    });
  });

  describe('processing outcomes', () => {
    it('marks event as processed on success', async () => {
      isProcessed.mockResolvedValue(null);
      markProcessed.mockResolvedValue();
      const alwaysSucceed = jest.fn().mockResolvedValue();
      await handleEvent({ ...baseEvent, retryCount: 0 }, 'orders', alwaysSucceed);
      expect(markProcessed).toHaveBeenCalledWith('order-001');
      expect(sendToRetryQueue).not.toHaveBeenCalled();
    });

    it('queues a retry with incremented retryCount on failure', async () => {
      isProcessed.mockResolvedValue(null);
      sendToRetryQueue.mockResolvedValue();
      const alwaysFail = jest.fn().mockRejectedValue(new Error('Downstream error'));
      await handleEvent({ ...baseEvent, retryCount: 1 }, 'orders', alwaysFail);
      expect(sendToRetryQueue).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order-001', retryCount: 2 })
      );
      expect(markProcessed).not.toHaveBeenCalled();
    });

    it('includes lastFailedAt and sourceTopic in retry event', async () => {
      isProcessed.mockResolvedValue(null);
      sendToRetryQueue.mockResolvedValue();
      const alwaysFail = jest.fn().mockRejectedValue(new Error('err'));
      await handleEvent({ ...baseEvent, retryCount: 0 }, 'orders', alwaysFail);
      const retryEvent = sendToRetryQueue.mock.calls[0][0];
      expect(retryEvent).toHaveProperty('lastFailedAt');
      expect(retryEvent).toHaveProperty('sourceTopic', 'orders');
    });
  });
});
