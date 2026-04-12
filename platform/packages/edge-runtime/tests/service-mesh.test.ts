// Test Ref: MTU-N469 §service-mesh
import { describe, it, expect } from 'vitest';
import {
  analyzeTraffic,
  computeTimeouts,
  computeCircuitBreaker,
  buildResiliencyPolicy,
  renderVirtualServiceYaml,
  renderDestinationRuleYaml,
  type TrafficSample,
} from '../src/index.js';

const sample: TrafficSample = {
  service: 'auth-service',
  latencyP50: 50,
  latencyP95: 200,
  latencyP99: 500,
  errorRate: 0.02,
  rps: 150,
};

describe('analyzeTraffic — FR-SM.1', () => {
  it('트래픽 패턴 플래그', () => {
    const flags = analyzeTraffic({ ...sample, latencyP95: 1500 });
    expect(flags.isHighLatency).toBe(true);
    expect(flags.isHighTraffic).toBe(true);
  });
});

describe('computeTimeouts — FR-SM.2', () => {
  it('p99 * 2 timeout 공식', () => {
    const t = computeTimeouts(sample);
    expect(t.timeoutMs).toBe(1000);
    expect(t.perTryTimeoutMs).toBe(300);
    expect(t.retries).toBe(2); // errorRate 0.02
  });

  it('높은 오류율 시 재시도 감소', () => {
    const t = computeTimeouts({ ...sample, errorRate: 0.1 });
    expect(t.retries).toBe(1);
  });
});

describe('computeCircuitBreaker — FR-SM.3', () => {
  it('높은 오류율 시 엄격한 임계값', () => {
    const cb = computeCircuitBreaker({ ...sample, errorRate: 0.1 });
    expect(cb.consecutiveErrors).toBe(3);
  });
});

describe('buildResiliencyPolicy + YAML — FR-SM.4/5', () => {
  it('전체 정책 빌드 + mTLS STRICT', () => {
    const policy = buildResiliencyPolicy(sample);
    expect(policy.mtls).toBe('STRICT');
    expect(policy.service).toBe('auth-service');
  });

  it('VirtualService YAML 생성', () => {
    const policy = buildResiliencyPolicy(sample);
    const yaml = renderVirtualServiceYaml(policy);
    expect(yaml).toContain('VirtualService');
    expect(yaml).toContain('auth-service');
    expect(yaml).toContain('timeout: 1000ms');
  });

  it('DestinationRule YAML + ISTIO_MUTUAL', () => {
    const policy = buildResiliencyPolicy(sample);
    const yaml = renderDestinationRuleYaml(policy);
    expect(yaml).toContain('DestinationRule');
    expect(yaml).toContain('ISTIO_MUTUAL');
    expect(yaml).toContain('outlierDetection');
  });
});
