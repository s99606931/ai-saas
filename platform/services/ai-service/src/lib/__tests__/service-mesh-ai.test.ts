import { describe, it, expect } from 'vitest';
import { ServiceMeshAi, type TrafficSample } from '../service-mesh-ai';

describe('ServiceMeshAi', () => {
  const svc = new ServiceMeshAi();

  const samples: TrafficSample[] = [
    { service: 'auth', p50LatencyMs: 50, p99LatencyMs: 200, errorRate: 0.001, rps: 500 },
    { service: 'payment', p50LatencyMs: 200, p99LatencyMs: 2000, errorRate: 0.08, rps: 50 },
  ];

  it('FR-SM.1 트래픽 분류', () => {
    const c = svc.classifyTraffic(samples);
    expect(c.find((x) => x.service === 'auth')?.risk).toBe('low');
    expect(c.find((x) => x.service === 'payment')?.risk).toBe('high');
  });

  it('FR-SM.2 타임아웃/재시도', () => {
    const r = svc.computeTimeoutAndRetries(samples[0]!);
    expect(r.timeoutMs).toBeGreaterThanOrEqual(400);
    expect(r.retries).toBe(3);
  });

  it('FR-SM.3 회로 차단기', () => {
    const cb = svc.computeCircuitBreaker(samples[1]!);
    expect(cb).toBeGreaterThanOrEqual(10);
  });

  it('FR-SM.4 mTLS', () => {
    const sensitive = new Set(['payment']);
    expect(svc.determineMtls(sensitive, 'payment')).toBe('STRICT');
    expect(svc.determineMtls(sensitive, 'auth')).toBe('PERMISSIVE');
  });

  it('FR-SM.5 YAML 생성', () => {
    const policy = svc.buildPolicy(samples[0]!, new Set());
    const yaml = svc.generateVirtualService(policy);
    expect(yaml).toContain('VirtualService');
    expect(yaml).toContain('auth');
  });
});
