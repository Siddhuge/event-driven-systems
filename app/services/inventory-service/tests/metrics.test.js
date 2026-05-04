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

  it('exports eventsProcessedTotal counter', () => {
    expect(typeof metrics.eventsProcessedTotal.inc).toBe('function');
  });

  it('exports eventProcessingDuration histogram', () => {
    expect(typeof metrics.eventProcessingDuration.startTimer).toBe('function');
    expect(typeof metrics.eventProcessingDuration.observe).toBe('function');
  });

  it('exports retryQueueTotal counter', () => {
    expect(typeof metrics.retryQueueTotal.inc).toBe('function');
  });

  it('exports dlqTotal counter', () => {
    expect(typeof metrics.dlqTotal.inc).toBe('function');
  });
});
