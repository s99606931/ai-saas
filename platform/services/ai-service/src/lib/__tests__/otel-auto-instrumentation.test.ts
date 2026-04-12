import { describe, it, expect } from 'vitest';
import { OtelAutoInstrumentation, type InstrumentationTarget, type TraceContext } from '../otel-auto-instrumentation';

describe('OtelAutoInstrumentation', () => {
  const svc = new OtelAutoInstrumentation();

  it('registers instrumentation targets', () => {
    const targets: InstrumentationTarget[] = [
      { library: 'http', module: 'node:http', version: '18', hookPoints: ['request'] },
      { library: 'postgres', module: 'pg', version: '8.11', hookPoints: ['query'] },
    ];
    const map = svc.registerTargets(targets);
    expect(map.size).toBe(2);
    expect(map.get('http')?.module).toBe('node:http');
  });

  it('builds and parses W3C traceparent', () => {
    const ctx: TraceContext = {
      traceId: '0af7651916cd43dd8448eb211c80319c',
      parentSpanId: 'b7ad6b7169203331',
      traceFlags: 1,
    };
    const header = svc.buildTraceparent(ctx);
    expect(header).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
    const parsed = svc.parseTraceparent(header);
    expect(parsed?.traceId).toBe(ctx.traceId);
    expect(parsed?.traceFlags).toBe(1);
  });

  it('returns null for invalid traceparent', () => {
    expect(svc.parseTraceparent('invalid')).toBeNull();
  });

  it('tags span with service metadata', () => {
    const span = svc.tagSpan(
      { library: 'http', operation: 'GET /users', startNs: 0, endNs: 1000, status: 'ok' },
      { service: 'user-svc', version: '1.0', environment: 'prod' },
    );
    expect(span.service).toBe('user-svc');
    expect(span.environment).toBe('prod');
  });

  it('amplifies sampling on error rate', () => {
    const policy = { baseRate: 0, errorAmplifier: 2, maxRatePerSec: 100 };
    let sampledHigh = 0;
    for (let i = 0; i < 100; i++) {
      if (svc.shouldSample(policy, 0.5, 10)) sampledHigh++;
    }
    expect(sampledHigh).toBeGreaterThan(50);
  });

  it('caps sampling at max rate', () => {
    const policy = { baseRate: 1, errorAmplifier: 0, maxRatePerSec: 100 };
    expect(svc.shouldSample(policy, 0, 100)).toBe(false);
  });

  it('summarizes export stats', () => {
    const stats = svc.summarizeExports([
      { ok: true, count: 50 },
      { ok: false, count: 10, error: 'network' },
      { ok: true, count: 30 },
    ]);
    expect(stats.spansExported).toBe(80);
    expect(stats.spansDropped).toBe(10);
    expect(stats.batchesSent).toBe(3);
  });
});
