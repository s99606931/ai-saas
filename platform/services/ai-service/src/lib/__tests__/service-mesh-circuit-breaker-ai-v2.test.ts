import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceMeshCircuitBreakerAIV2 } from '../service-mesh-circuit-breaker-ai-v2';

describe('ServiceMeshCircuitBreakerAIV2', () => {
  let breaker: ServiceMeshCircuitBreakerAIV2;

  beforeEach(() => {
    breaker = new ServiceMeshCircuitBreakerAIV2();
    breaker.registerService({ serviceId: 'svc1', failureThreshold: 0.5 });
  });

  it('CLOSED on low failure rate', () => {
    breaker.recordCall({ serviceId: 'svc1', callerId: 'c', success: true });
    const v = breaker.recordCall({ serviceId: 'svc1', callerId: 'c', success: true });
    expect(v.state).toBe('CLOSED');
    expect(v.failureRate).toBe(0);
  });

  it('HALF_OPEN in mid range', () => {
    breaker.recordCall({ serviceId: 'svc1', callerId: 'c', success: true });
    breaker.recordCall({ serviceId: 'svc1', callerId: 'c', success: true });
    const v = breaker.recordCall({ serviceId: 'svc1', callerId: 'c', success: false });
    expect(v.failureRate).toBeCloseTo(0.333, 2);
    expect(v.state).toBe('HALF_OPEN');
  });

  it('OPEN when failure rate >= threshold and lists open circuits', () => {
    breaker.recordCall({ serviceId: 'svc1', callerId: 'c', success: false });
    const v = breaker.recordCall({ serviceId: 'svc1', callerId: 'c', success: false });
    expect(v.state).toBe('OPEN');
    expect(breaker.getOpenCircuits()).toEqual(['svc1']);
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      breaker.recordCall({ serviceId: 'svc1', callerId: 'c', success: true }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      breaker.recordCall({ serviceId: 'svc1', callerId: 'c', success: true }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown service and invalid threshold', () => {
    expect(() =>
      breaker.recordCall({ serviceId: 'missing', callerId: 'c', success: true }),
    ).toThrow('UNKNOWN_SERVICE');
    expect(() =>
      breaker.registerService({ serviceId: 'bad', failureThreshold: 0 }),
    ).toThrow('INVALID_THRESHOLD');
  });

  it('audit log masks caller id', () => {
    breaker.recordCall({ serviceId: 'svc1', callerId: '900101-1234567', success: false });
    const log = breaker.getAuditLog();
    expect(log.some((e) => e.action === 'RECORD_CALL')).toBe(true);
    for (const entry of log) {
      expect(JSON.stringify(entry.details ?? {})).not.toContain('900101');
    }
  });
});
