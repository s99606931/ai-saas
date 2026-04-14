import { describe, it, expect, beforeEach } from 'vitest';
import { MicroserviceChaosTesterAIV2 } from '../microservice-chaos-tester-ai-v2';

describe('MicroserviceChaosTesterAIV2', () => {
  let t: MicroserviceChaosTesterAIV2;

  beforeEach(() => {
    t = new MicroserviceChaosTesterAIV2();
  });

  it('generates scenario with masked target', () => {
    const s = t.generateScenario('payment-svc', 'LATENCY');
    expect(s.maskedTarget).toMatch(/^[0-9a-f]{16}$/);
    expect(s.maskedTarget).not.toContain('payment');
    expect(s.type).toBe('LATENCY');
  });

  it('evaluates RESILIENT for healthy service', () => {
    const r = t.evaluate({ errorRate: 0.01, p95LatencyMs: 110, baselineLatencyMs: 100 });
    expect(r.grade).toBe('RESILIENT');
  });

  it('evaluates FRAGILE for collapsing service', () => {
    const r = t.evaluate({ errorRate: 0.8, p95LatencyMs: 5000, baselineLatencyMs: 100 });
    expect(r.grade).toBe('FRAGILE');
  });

  it('evaluates MARGINAL for degraded service', () => {
    const r = t.evaluate({ errorRate: 0.3, p95LatencyMs: 200, baselineLatencyMs: 100 });
    expect(r.grade).toBe('MARGINAL');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() => t.generateScenario('svc', 'ERROR', 'C')).toThrow('BLOCKED');
    expect(() => t.generateScenario('svc', 'ERROR', 'S')).toThrow('BLOCKED');
  });

  it('records audit log', () => {
    t.generateScenario('svc', 'NETWORK_PARTITION');
    t.evaluate({ errorRate: 0.1, p95LatencyMs: 100, baselineLatencyMs: 100 });
    const log = t.getAuditLog();
    expect(log.some((e) => e.action === 'GENERATE_SCENARIO')).toBe(true);
    expect(log.some((e) => e.action === 'EVALUATE')).toBe(true);
  });
});
