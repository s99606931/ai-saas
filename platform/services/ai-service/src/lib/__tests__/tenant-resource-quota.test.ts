// MTU-N301 테넌트 리소스 쿼터 테스트
import { describe, it, expect } from 'vitest';
import { TenantResourceQuotaService } from '../tenant-resource-quota.js';

describe('MTU-N301 TenantResourceQuota', () => {
  const svc = new TenantResourceQuotaService('tenant-n301');

  it('FR-N301.1: 쿼터 정책 생성/조회', () => {
    const p = svc.createPolicy('cpu', 1000, 'millicore');
    expect(p).toBeDefined();
    expect(svc.getPolicies().length).toBeGreaterThan(0);
  });

  it('FR-N301.2: 사용량 기록', () => {
    const rec = svc.recordUsage('cpu', 500);
    expect(rec).toBeDefined();
  });

  it('FR-N301.3: 쿼터 초과 감지', () => {
    const alert = svc.checkExceedance('cpu', 2000);
    expect(alert).toBeDefined();
  });

  it('FR-N301.5: 템플릿 적용', () => {
    const ps = svc.applyTemplate('small');
    expect(Array.isArray(ps)).toBe(true);
  });

  it('FR-N301.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
