const mockKafkaConstructor = jest.fn().mockReturnValue({ producer: jest.fn() });

jest.mock('kafkajs', () => ({ Kafka: mockKafkaConstructor }));

describe('Kafka config', () => {
  beforeEach(() => {
    jest.resetModules();
    mockKafkaConstructor.mockClear();
  });

  it('creates a Kafka client with CLIENT_ID and KAFKA_BROKER env vars', () => {
    process.env.CLIENT_ID = 'test-service';
    process.env.KAFKA_BROKER = 'kafka:9092';
    require('../src/config/kafka');
    expect(mockKafkaConstructor).toHaveBeenCalledWith({
      clientId: 'test-service',
      brokers: ['kafka:9092']
    });
  });

  it('creates a Kafka client using undefined when env vars are absent', () => {
    delete process.env.CLIENT_ID;
    delete process.env.KAFKA_BROKER;
    require('../src/config/kafka');
    expect(mockKafkaConstructor).toHaveBeenCalledWith({
      clientId: undefined,
      brokers: [undefined]
    });
  });
});
