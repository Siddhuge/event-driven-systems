jest.mock('../src/health', () => ({ setReady: jest.fn() }));
jest.mock('../src/logger', () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock('../src/consumers/orderConsumer', () => ({ runConsumer: jest.fn() }));

const { setReady } = require('../src/health');
const logger = require('../src/logger');
const { runConsumer } = require('../src/consumers/orderConsumer');
const startApp = require('../src/app');

describe('app startup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls runConsumer, marks kafka ready, and returns the stop function', async () => {
    const mockStop = jest.fn();
    runConsumer.mockResolvedValue(mockStop);
    const stop = await startApp();
    expect(runConsumer).toHaveBeenCalledTimes(1);
    expect(setReady).toHaveBeenCalledWith('kafka', true);
    expect(stop).toBe(mockStop);
  });

  it('logs error and rethrows when runConsumer fails', async () => {
    const err = new Error('consumer failed');
    runConsumer.mockRejectedValue(err);
    await expect(startApp()).rejects.toThrow('consumer failed');
    expect(logger.error).toHaveBeenCalledWith(
      { error: 'consumer failed' },
      'Failed to start inventory consumer'
    );
    expect(setReady).not.toHaveBeenCalled();
  });
});
