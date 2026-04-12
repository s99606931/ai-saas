// MTU-N317 API 속도 제한 테스트
import { describe, it, expect } from 'vitest';
import { APIRateLimiterService } from '../api-rate-limiter.js';

describe('MTU-N317 APIRateLimiter', () => {
  const svc = new APIRateLimiterService('tenant-n317');

  it('FR-N317.1: 정책 생성', () => {
    const policy = svc.createPolicy('/api/orders', 100, 60);
    expect(policy).toBeDefined();
    expect(svc.getPolicies().length).toBeGreaterThan(0);
  });

  it('FR-N317.2: 속도 제한 확인', () => {
    svc.createPolicy('/api/users', 10, 60);
    const result = svc.check('/api/users', 'client-1');
    expect(result).toBeDefined();
    expect(typeof result.allowed).toBe('boolean');
  });

  it('FR-N317.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
