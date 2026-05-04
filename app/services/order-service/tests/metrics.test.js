describe('metrics module', () => {
  let metrics;

  beforeAll(() => {
    metrics = require('../src/metrics');
  });

  it('exports a prom-client registry', () => {
    expect(typeof metrics.register.metrics).toBe('function');
    expect(typeof metrics.register.contentType).toBe('string');
  });

  it('register.metrics() resolves to a non-empty string', async () => {
    const output = await metrics.register.metrics();
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('exports ordersCreatedTotal counter', () => {
    expect(typeof metrics.ordersCreatedTotal.inc).toBe('function');
  });

  it('exports orderCreationDuration histogram', () => {
    expect(typeof metrics.orderCreationDuration.startTimer).toBe('function');
    expect(typeof metrics.orderCreationDuration.observe).toBe('function');
  });

  it('exports kafkaProduceErrorsTotal counter', () => {
    expect(typeof metrics.kafkaProduceErrorsTotal.inc).toBe('function');
  });
});
