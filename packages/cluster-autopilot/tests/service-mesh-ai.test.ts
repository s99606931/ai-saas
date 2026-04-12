/**
 * 서비스 메시 AI 테스트
 * Plan SC: FR-SM.1~5
 */

import {
  TrafficPolicyAdvisor,
  VirtualServiceGenerator,
  TrafficAnalyzer,
} from '../src/service-mesh-ai';

const samplePattern = (overrides = {}) => ({
  service: 'svc-a',
  p50LatencyMs: 50,
  p95LatencyMs: 100,
  p99LatencyMs: 150,
  errorRatePercent: 0.5,
  requestsPerSec: 100,
  ...overrides,
});

describe('TrafficPolicyAdvisor', () => {
  const a = new TrafficPolicyAdvisor();

  it('타임아웃: p99 * 1.5 (최소 100ms)', () => {
    expect(a.recommendTimeout(samplePattern({ p99LatencyMs: 200 }))).toBe(300);
    expect(a.recommendTimeout(samplePattern({ p99LatencyMs: 10 }))).toBe(100);
  });

  it('재시도: 에러율 1% 미만 → 2회', () => {
    expect(a.recommendRetries(samplePattern({ errorRatePercent: 0.5 }))).toBe(2);
  });

  it('재시도: 1-5% → 3회', () => {
    expect(a.recommendRetries(samplePattern({ errorRatePercent: 3 }))).toBe(3);
  });

  it('재시도: 5%+ → 1회', () => {
    expect(a.recommendRetries(samplePattern({ errorRatePercent: 10 }))).toBe(1);
  });

  it('회로 차단기: 임계값 추천', () => {
    const r = a.recommendCircuitBreaker(samplePattern({ requestsPerSec: 200 }));
    expect(r.maxConnections).toBeGreaterThanOrEqual(400);
    expect(r.ejectionDurationSec).toBe(30);
  });

  it('회로 차단기: 에러율 2% 초과 시 consecutiveErrors 3', () => {
    const r = a.recommendCircuitBreaker(samplePattern({ errorRatePercent: 5 }));
    expect(r.consecutiveErrors).toBe(3);
  });
});

describe('VirtualServiceGenerator', () => {
  const g = new VirtualServiceGenerator();

  it('mTLS 비활성: VirtualService만 생성', () => {
    const yaml = g.generate({
      name: 'svc-a',
      namespace: 'ns',
      host: 'svc-a.ns.svc',
      timeout: 1000,
      retries: 2,
      mtlsEnabled: false,
    });
    expect(yaml).toContain('VirtualService');
    expect(yaml).toContain('timeout: 1000ms');
    expect(yaml).toContain('attempts: 2');
    expect(yaml).not.toContain('PeerAuthentication');
  });

  it('mTLS 활성: PeerAuthentication 추가', () => {
    const yaml = g.generate({
      name: 'svc-a',
      namespace: 'ns',
      host: 'svc-a.ns.svc',
      timeout: 1000,
      retries: 2,
      mtlsEnabled: true,
    });
    expect(yaml).toContain('PeerAuthentication');
    expect(yaml).toContain('STRICT');
  });
});

describe('TrafficAnalyzer', () => {
  const a = new TrafficAnalyzer();

  it('서비스별 RPS 평균/최대 + p99', () => {
    const r = a.analyze([
      samplePattern({ service: 'svc-a', requestsPerSec: 100, p99LatencyMs: 100 }),
      samplePattern({ service: 'svc-a', requestsPerSec: 200, p99LatencyMs: 200 }),
      samplePattern({ service: 'svc-b', requestsPerSec: 50, p99LatencyMs: 30 }),
    ]);
    const a1 = r.find((x) => x.service === 'svc-a');
    expect(a1?.avgRps).toBe(150);
    expect(a1?.peakRps).toBe(200);
    expect(a1?.p99LatencyMs).toBe(200);
  });
});
