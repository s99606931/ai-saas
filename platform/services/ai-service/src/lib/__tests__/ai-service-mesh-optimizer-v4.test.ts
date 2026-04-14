import { describe, it, expect, beforeEach } from 'vitest';
import { AIServiceMeshOptimizerV4 } from '../ai-service-mesh-optimizer-v4';

describe('AIServiceMeshOptimizerV4', () => {
  let opt: AIServiceMeshOptimizerV4;

  beforeEach(() => {
    opt = new AIServiceMeshOptimizerV4();
    opt.registerService({ serviceId: 'svc-api', targetLatencyMs: 100, sloErrorRate: 0.01 });
  });

  it('FR-R700.1/3/4: HEALTHY→KEEP when within SLO', () => {
    const v = opt.recordTelemetry('svc-api', { latencyMs: 80, errorRate: 0.005 });
    expect(v.health).toBe('HEALTHY');
    expect(v.action).toBe('KEEP');
    expect(v.maskedServiceId).toHaveLength(16);
    expect(v.maskedServiceId).not.toContain('svc-api');
  });

  it('FR-R700.3/4: DEGRADED→REROUTE when within 2x SLO', () => {
    const v = opt.recordTelemetry('svc-api', { latencyMs: 150, errorRate: 0.015 });
    expect(v.health).toBe('DEGRADED');
    expect(v.action).toBe('REROUTE');
  });

  it('FR-R700.3/4: CRITICAL→QUARANTINE when over 2x SLO', () => {
    const v = opt.recordTelemetry('svc-api', { latencyMs: 500, errorRate: 0.5 });
    expect(v.health).toBe('CRITICAL');
    expect(v.action).toBe('QUARANTINE');
    expect(opt.getQuarantined()).toHaveLength(1);
  });

  it('FR-R700.2: blocks C/S grade (N2SF N-05)', () => {
    expect(() => opt.recordTelemetry('svc-api', { latencyMs: 10, errorRate: 0.001 }, 'C')).toThrow('BLOCKED');
    expect(() => opt.recordTelemetry('svc-api', { latencyMs: 10, errorRate: 0.001 }, 'S')).toThrow('BLOCKED');
  });

  it('FR-R700.2: rejects unknown service and invalid inputs', () => {
    expect(() => opt.recordTelemetry('ghost', { latencyMs: 10, errorRate: 0.001 })).toThrow('UNKNOWN_SERVICE');
    expect(() => opt.recordTelemetry('svc-api', { latencyMs: -1, errorRate: 0 })).toThrow('INVALID_LATENCY');
    expect(() => opt.recordTelemetry('svc-api', { latencyMs: 0, errorRate: 2 })).toThrow('INVALID_ERROR_RATE');
    expect(() => opt.registerService({ serviceId: 'x', targetLatencyMs: 0, sloErrorRate: 0 })).toThrow('INVALID_TARGET');
    expect(() => opt.registerService({ serviceId: 'x', targetLatencyMs: 1, sloErrorRate: 2 })).toThrow('INVALID_SLO');
  });

  it('FR-R700.5: audit log append-only with masked ids', () => {
    opt.recordTelemetry('svc-api', { latencyMs: 1000, errorRate: 0.9 });
    const logs = opt.getAuditLog();
    expect(logs.some((e) => e.action === 'REGISTER_SERVICE')).toBe(true);
    expect(logs.some((e) => e.action === 'RECORD_TELEMETRY')).toBe(true);
    for (const e of logs) {
      expect(JSON.stringify(e.details ?? {})).not.toContain('svc-api');
    }
  });

  it('FR-R700.5: audit log immutable (clone returned)', () => {
    const first = opt.getAuditLog();
    first.push({ timestamp: 'x', action: 'TAMPER' });
    expect(opt.getAuditLog().some((e) => e.action === 'TAMPER')).toBe(false);
  });
});
