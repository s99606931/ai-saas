// Plan SC: FR-R85.1~5
import { describe, it, expect } from 'vitest';
import { LatencyPredictor, createLatencyPredictor } from '../latency-predictor';

describe('LatencyPredictor', () => {
  it('FR-R85.1: observe records latencies', () => {
    const p = createLatencyPredictor(100);
    for (let i = 1; i <= 10; i++) p.observe(i * 10, 5);
    expect(p.size()).toBe(10);
  });

  it('FR-R85.2: percentile returns sorted values', () => {
    const p = createLatencyPredictor();
    for (let i = 1; i <= 100; i++) p.observe(i, 1);
    expect(p.percentile(0.5)).toBe(50);
    expect(p.percentile(0.95)).toBe(95);
    expect(p.percentile(0.99)).toBe(99);
  });

  it('FR-R85.3: predictWithLoad boosts under higher qps', () => {
    const p = createLatencyPredictor();
    for (let i = 1; i <= 100; i++) p.observe(100, 10); // 고정 100ms at 10 qps
    const res = p.predictWithLoad({ targetQps: 20 });
    expect(res.loadFactor).toBeCloseTo(2, 1);
    expect(res.predicted).toBeGreaterThan(100);
    expect(res.predicted).toBeLessThanOrEqual(300);
  });

  it('FR-R85.4: SLA violation flagged when predicted > threshold', () => {
    const p = createLatencyPredictor();
    for (let i = 1; i <= 50; i++) p.observe(200, 5);
    const res = p.predictWithLoad({ targetQps: 10, slaThresholdMs: 100 });
    expect(res.slaViolationLikely).toBe(true);
    expect(p.getAuditLog().some((e) => e.action === 'WARN')).toBe(true);
  });

  it('FR-R85.5: audit log contains OBSERVE/PREDICT', () => {
    const p = createLatencyPredictor();
    p.observe(50, 1);
    p.predictWithLoad({ targetQps: 1 });
    const log = p.getAuditLog();
    expect(log.some((e) => e.action === 'OBSERVE')).toBe(true);
    expect(log.some((e) => e.action === 'PREDICT')).toBe(true);
  });

  it('ring buffer capacity respected', () => {
    const p = createLatencyPredictor(10);
    for (let i = 0; i < 20; i++) p.observe(i, 1);
    expect(p.size()).toBe(10);
  });

  it('empty buffer returns 0 for percentile', () => {
    const p = createLatencyPredictor();
    expect(p.percentile(0.5)).toBe(0);
  });

  it('rejects invalid capacity/observation', () => {
    expect(() => new LatencyPredictor(5)).toThrow();
    const p = createLatencyPredictor();
    expect(() => p.observe(-1)).toThrow();
  });
});
