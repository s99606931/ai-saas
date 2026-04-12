// MTU-N345 테넌트 사용 분석 테스트
import { describe, it, expect } from 'vitest';
import { TenantUsageAnalyticsService } from '../tenant-usage-analytics.js';

describe('MTU-N345 TenantUsageAnalytics', () => {
  const svc = new TenantUsageAnalyticsService('tenant-n345');

  it('FR-N345.1: 이벤트 기록', () => {
    const e = svc.record('user-1', 'dashboard', 'view');
    expect(e).toBeDefined();
  });

  it('FR-N345.2: 사용 집계', () => {
    svc.record('user-2', 'reports', 'export');
    const summary = svc.aggregate('2026-04');
    expect(summary).toBeDefined();
  });

  it('FR-N345.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
