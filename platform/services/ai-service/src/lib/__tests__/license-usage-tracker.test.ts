// MTU-N302 라이선스 사용량 추적 테스트
import { describe, it, expect } from 'vitest';
import { LicenseUsageTrackerService } from '../license-usage-tracker.js';

describe('MTU-N302 LicenseUsageTracker', () => {
  const svc = new LicenseUsageTrackerService('tenant-n302');

  it('FR-N302.1: 라이선스 등록', () => {
    const lic = svc.register('per_user', 'Enterprise License', 100, 'users', '2027-04-11');
    expect(lic).toBeDefined();
    expect(svc.getLicenses().length).toBeGreaterThan(0);
  });

  it('FR-N302.2: 사용량 기록', () => {
    const lic = svc.register('per_user', 'Test License', 50, 'users', '2027-04-11');
    const metric = svc.recordUsage(lic.licenseId, 30);
    expect(metric).toBeDefined();
  });

  it('FR-N302.3: 초과 감지', () => {
    const lic = svc.register('per_user', 'Small License', 10, 'users', '2027-04-11');
    const alert = svc.checkExceedance(lic.licenseId, 20);
    expect(alert).toBeDefined();
  });

  it('FR-N302.4: 월별 리포트', () => {
    const rpt = svc.generateReport('2026-04');
    expect(rpt).toBeDefined();
  });

  it('FR-N302.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
