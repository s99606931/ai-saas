import { describe, it, expect, beforeEach } from 'vitest';
import { DistributedTracingAIV3 } from '../distributed-tracing-ai-v3';

describe('DistributedTracingAIV3', () => {
  let dt: DistributedTracingAIV3;

  beforeEach(() => {
    dt = new DistributedTracingAIV3();
    dt.registerTrace({ traceId: 't1', rootService: 'gateway', totalMs: 1000 });
  });

  it('classifies CRITICAL + OPTIMIZE for ratio >= 0.5', () => {
    const a = dt.analyzeSpan({
      spanId: 's',
      traceId: 't1',
      serviceName: 'db',
      durationMs: 600,
      hasError: false,
    });
    expect(a.level).toBe('CRITICAL');
    expect(a.action).toBe('OPTIMIZE');
  });

  it('classifies HIGH + PROFILE for ratio 0.25~0.5', () => {
    const a = dt.analyzeSpan({
      spanId: 's',
      traceId: 't1',
      serviceName: 'db',
      durationMs: 300,
      hasError: false,
    });
    expect(a.level).toBe('HIGH');
    expect(a.action).toBe('PROFILE');
  });

  it('classifies LOW + IGNORE for ratio < 0.25', () => {
    const a = dt.analyzeSpan({
      spanId: 's',
      traceId: 't1',
      serviceName: 'db',
      durationMs: 100,
      hasError: false,
    });
    expect(a.level).toBe('LOW');
    expect(a.action).toBe('IGNORE');
  });

  it('escalates one rank when hasError=true', () => {
    const a = dt.analyzeSpan({
      spanId: 's',
      traceId: 't1',
      serviceName: 'db',
      durationMs: 100,
      hasError: true,
    });
    expect(a.action).toBe('PROFILE');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      dt.analyzeSpan(
        { spanId: 's', traceId: 't1', serviceName: 'db', durationMs: 100, hasError: false },
        'C',
      ),
    ).toThrow('BLOCKED');
    expect(() =>
      dt.analyzeSpan(
        { spanId: 's', traceId: 't1', serviceName: 'db', durationMs: 100, hasError: false },
        'S',
      ),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown trace, invalid duration and invalid total', () => {
    expect(() =>
      dt.analyzeSpan({
        spanId: 's',
        traceId: 'unknown',
        serviceName: 'db',
        durationMs: 10,
        hasError: false,
      }),
    ).toThrow('UNKNOWN_TRACE');
    expect(() =>
      dt.analyzeSpan({
        spanId: 's',
        traceId: 't1',
        serviceName: 'db',
        durationMs: -1,
        hasError: false,
      }),
    ).toThrow('INVALID_DURATION');
    expect(() => dt.registerTrace({ traceId: 'x', rootService: 'x', totalMs: 0 })).toThrow(
      'INVALID_TOTAL_MS',
    );
  });

  it('lists optimize targets and maintains audit log', () => {
    dt.analyzeSpan({
      spanId: 's1',
      traceId: 't1',
      serviceName: 'db',
      durationMs: 700,
      hasError: false,
    });
    dt.analyzeSpan({
      spanId: 's2',
      traceId: 't1',
      serviceName: 'cache',
      durationMs: 50,
      hasError: false,
    });
    expect(dt.getOptimizeTargets().map((a) => a.spanId)).toEqual(['s1']);
    expect(dt.getAuditLog().some((e) => e.action === 'ANALYZE_SPAN')).toBe(true);
  });
});
