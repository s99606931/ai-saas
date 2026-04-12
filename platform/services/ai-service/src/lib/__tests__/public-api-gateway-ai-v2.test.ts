import { describe, it, expect } from 'vitest';
import { PublicApiGatewayAiV2, type ApiRequest } from '../public-api-gateway-ai-v2.js';

describe('SVC-AI-ADV-R363 PublicApiGatewayAiV2', () => {
  const svc = new PublicApiGatewayAiV2();

  const mkReqs = (n: number, payload = 'hello'): ApiRequest[] =>
    Array.from({ length: n }, (_, i) => ({
      clientId: 'c1',
      path: '/api',
      payload,
      timestamp: i,
    }));

  it('FR-363.1: 정상 트래픽 통과', () => {
    const r = svc.analyze(mkReqs(5), 10, 10);
    expect(r.spike).toBe(false);
    expect(r.block).toBe(false);
  });

  it('FR-363.1: 스파이크 탐지', () => {
    const r = svc.analyze(mkReqs(200), 10, 10);
    expect(r.spike).toBe(true);
    expect(r.block).toBe(true);
  });

  it('FR-363.2: 악성 패턴', () => {
    const reqs = mkReqs(3, "'; DROP TABLE users;--");
    const r = svc.analyze(reqs, 10, 100);
    expect(r.malicious).toBe(true);
    expect(r.block).toBe(true);
  });

  it('FR-363.3: C등급 차단', () => {
    expect(() => svc.analyze(mkReqs(3), 10, 10, 'C')).toThrow('N2SF_BLOCKED');
  });

  it('FR-363.4: 감사 로그', () => {
    svc.analyze(mkReqs(3), 10, 10);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
