describe('Kafka producer (inventory)', () => {
  let connectProducer, disconnectProducer, sendToTopic, isProducerConnected;
  let mockProducer;

  beforeEach(() => {
    jest.resetModules();
    mockProducer = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      send: jest.fn().mockResolvedValue()
    };
    jest.mock('../src/kafka/kafka', () => ({ producer: jest.fn(() => mockProducer) }));
    jest.mock('../src/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
    ({ connectProducer, disconnectProducer, sendToTopic, isProducerConnected } =
      require('../src/kafka/producer'));
  });

  it('isProducerConnected returns false before connecting', () => {
    expect(isProducerConnected()).toBe(false);
  });

  it('connectProducer calls connect() and marks producer as connected', async () => {
    await connectProducer();
    expect(mockProducer.connect).toHaveBeenCalledTimes(1);
    expect(isProducerConnected()).toBe(true);
  });

  it('disconnectProducer calls disconnect() and marks producer as disconnected', async () => {
    await connectProducer();
    await disconnectProducer();
    expect(mockProducer.disconnect).toHaveBeenCalledTimes(1);
    expect(isProducerConnected()).toBe(false);
  });

  it('sendToTopic sends JSON-serialised message to the correct topic', async () => {
    const message = { orderId: 'o1', items: [] };
    await sendToTopic('orders', message);
    expect(mockProducer.send).toHaveBeenCalledWith({
      topic: 'orders',
      messages: [{ value: JSON.stringify(message) }]
    });
  });
});
