describe('logger module', () => {
  let logger;

  beforeAll(() => {
    logger = require('../src/logger');
  });

  it('exports a pino logger with info/warn/error methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('can log a message without throwing (exercises formatters.level)', () => {
    expect(() => logger.info('test message')).not.toThrow();
  });

  it('supports child logger creation', () => {
    const child = logger.child({ orderId: 'test-123' });
    expect(typeof child.info).toBe('function');
  });
});
