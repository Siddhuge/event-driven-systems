const mockConsumerInstance = {
  connect: jest.fn().mockResolvedValue(),
  subscribe: jest.fn().mockResolvedValue(),
  run: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue()
};

jest.mock('../src/kafka/kafka', () => ({
  consumer: jest.fn().mockReturnValue(mockConsumerInstance)
}));

jest.mock('../src/kafka/producer', () => ({
  connectProducer: jest.fn().mockResolvedValue(),
  disconnectProducer: jest.fn().mockResolvedValue(),
  sendToTopic: jest.fn().mockResolvedValue(),
  isProducerConnected: jest.fn().mockReturnValue(true)
}));

jest.mock('../src/rabbitmq/producer', () => ({
  connectRabbit: jest.fn().mockResolvedValue(),
  disconnectRabbit: jest.fn().mockResolvedValue(),
  sendToRetryQueue: jest.fn().mockResolvedValue()
}));

jest.mock('../src/utils/idempotency', () => ({
  isProcessed: jest.fn().mockResolvedValue(null),
  markProcessed: jest.fn().mockResolvedValue()
}));

jest.mock('../src/health', () => ({ setReady: jest.fn() }));

jest.mock('../src/metrics', () => ({
  eventsProcessedTotal: { inc: jest.fn() },
  eventProcessingDuration: { startTimer: jest.fn(() => jest.fn()) },
  retryQueueTotal: { inc: jest.fn() },
  dlqTotal: { inc: jest.fn() }
}));

jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  child: jest.fn().mockReturnThis()
}));

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(),
    once: jest.fn(),
    on: jest.fn()
  }))
);

const { runConsumer, processOrder } = require('../src/consumers/orderConsumer');
const { setReady } = require('../src/health');
const { connectProducer, disconnectProducer } = require('../src/kafka/producer');
const { connectRabbit, disconnectRabbit } = require('../src/rabbitmq/producer');

describe('runConsumer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('connects consumer, producer, and rabbit then subscribes and runs', async () => {
    await runConsumer();
    expect(mockConsumerInstance.connect).toHaveBeenCalledTimes(1);
    expect(connectProducer).toHaveBeenCalledTimes(1);
    expect(connectRabbit).toHaveBeenCalledTimes(1);
    expect(mockConsumerInstance.subscribe).toHaveBeenCalledTimes(2);
    expect(mockConsumerInstance.run).toHaveBeenCalledTimes(1);
  });

  it('marks kafka ready after consumer connects', async () => {
    await runConsumer();
    expect(setReady).toHaveBeenCalledWith('kafka', true);
  });

  it('returns a stop function', async () => {
    const stop = await runConsumer();
    expect(typeof stop).toBe('function');
  });

  it('stop function disconnects consumer, rabbit, and producer', async () => {
    const stop = await runConsumer();
    await stop();
    expect(mockConsumerInstance.disconnect).toHaveBeenCalledTimes(1);
    expect(disconnectRabbit).toHaveBeenCalledTimes(1);
    expect(disconnectProducer).toHaveBeenCalledTimes(1);
  });

  it('eachMessage processes a valid JSON event', async () => {
    await runConsumer();
    const { eachMessage } = mockConsumerInstance.run.mock.calls[0][0];
    const event = { orderId: 'o-run-1', items: [] };
    await eachMessage({ topic: 'orders', message: { value: Buffer.from(JSON.stringify(event)) } });
  });

  it('eachMessage silently drops a message with invalid JSON (safeJsonParse catch path)', async () => {
    await runConsumer();
    const { eachMessage } = mockConsumerInstance.run.mock.calls[0][0];
    await expect(
      eachMessage({ topic: 'orders', message: { value: Buffer.from('not-valid-json') } })
    ).resolves.toBeUndefined();
  });
});

describe('processOrder', () => {
  it('logs inventory reserved for a valid event', async () => {
    const logger = require('../src/logger');
    await processOrder({ orderId: 'o1', items: [{ productId: 'p1', quantity: 2 }] });
    expect(logger.info).toHaveBeenCalled();
  });

  it('handles event with missing items without throwing', async () => {
    await expect(processOrder({ orderId: 'o2' })).resolves.toBeUndefined();
  });
});
