describe('RabbitMQ producer', () => {
  let connectRabbit, disconnectRabbit, sendToRetryQueue;
  let mockChannel, mockConnection;

  beforeEach(() => {
    jest.resetModules();
    mockChannel = {
      assertQueue: jest.fn().mockResolvedValue(),
      sendToQueue: jest.fn().mockReturnValue(true),
      close: jest.fn().mockResolvedValue()
    };
    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue(),
      on: jest.fn()
    };
    jest.mock('amqplib', () => ({ connect: jest.fn().mockResolvedValue(mockConnection) }));
    jest.mock('../src/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
    ({ connectRabbit, disconnectRabbit, sendToRetryQueue } =
      require('../src/rabbitmq/producer'));
  });

  it('connectRabbit connects and asserts all retry queues plus retry_processed', async () => {
    await connectRabbit();
    expect(mockConnection.createChannel).toHaveBeenCalledTimes(1);
    // 3 retry queues + 1 retry_processed
    expect(mockChannel.assertQueue).toHaveBeenCalledTimes(4);
  });

  it('connectRabbit fires connection error event handler', async () => {
    const logger = require('../src/logger');
    await connectRabbit();
    const errorCb = mockConnection.on.mock.calls.find(([e]) => e === 'error')[1];
    errorCb(new Error('conn error'));
    expect(logger.error).toHaveBeenCalled();
  });

  it('connectRabbit fires connection close event handler', async () => {
    const logger = require('../src/logger');
    await connectRabbit();
    const closeCb = mockConnection.on.mock.calls.find(([e]) => e === 'close')[1];
    closeCb();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('disconnectRabbit closes channel and connection after connect', async () => {
    await connectRabbit();
    await disconnectRabbit();
    expect(mockChannel.close).toHaveBeenCalledTimes(1);
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  it('disconnectRabbit handles undefined channel and connection gracefully', async () => {
    await expect(disconnectRabbit()).resolves.toBeUndefined();
  });

  it('disconnectRabbit logs error when channel.close() throws', async () => {
    const logger = require('../src/logger');
    await connectRabbit();
    mockChannel.close.mockRejectedValue(new Error('close error'));
    await disconnectRabbit();
    expect(logger.error).toHaveBeenCalled();
  });

  it('sendToRetryQueue sends to retry_5s for retryCount 1', async () => {
    await connectRabbit();
    await sendToRetryQueue({ orderId: 'o1', retryCount: 1 });
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      'retry_5s', expect.any(Buffer), { persistent: true }
    );
  });

  it('sendToRetryQueue sends to retry_30s for retryCount 2', async () => {
    await connectRabbit();
    await sendToRetryQueue({ orderId: 'o1', retryCount: 2 });
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      'retry_30s', expect.any(Buffer), { persistent: true }
    );
  });

  it('sendToRetryQueue sends to retry_2m for retryCount 3', async () => {
    await connectRabbit();
    await sendToRetryQueue({ orderId: 'o1', retryCount: 3 });
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      'retry_2m', expect.any(Buffer), { persistent: true }
    );
  });

  it('sendToRetryQueue defaults to retryCount 1 when absent', async () => {
    await connectRabbit();
    await sendToRetryQueue({ orderId: 'o1' });
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      'retry_5s', expect.any(Buffer), { persistent: true }
    );
  });

  it('sendToRetryQueue does nothing for unknown retryCount', async () => {
    await connectRabbit();
    await sendToRetryQueue({ orderId: 'o1', retryCount: 99 });
    expect(mockChannel.sendToQueue).not.toHaveBeenCalled();
  });
});
