// MTU-N325 자동 스케일링 조언 테스트
import { describe, it, expect } from 'vitest';
import { AutoScalingAdvisorService } from '../auto-scaling-advisor.js';

describe('MTU-N325 AutoScalingAdvisor', () => {
  const svc = new AutoScalingAdvisorService('tenant-n325');

  it('FR-N325.1: 정책 생성', () => {
    const p = svc.createPolicy('api-svc', 2, 10);
    expect(p).toBeDefined();
  });

  it('FR-N325.2: 사용량 분석', () => {
    const recs = svc.analyze([
      { resourceId: 'r1', serviceName: 'api-svc', metricType: 'cpu', current: 80, peak: 95, average: 75, capacity: 100, unit: '%', timestamp: '2026-04-11' },
    ], 3);
    expect(Array.isArray(recs)).toBe(true);
  });

  it('FR-N325.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
