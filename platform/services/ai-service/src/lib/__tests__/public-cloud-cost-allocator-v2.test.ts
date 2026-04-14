import { describe, it, expect, beforeEach } from 'vitest';
import { PublicCloudCostAllocatorV2 } from '../public-cloud-cost-allocator-v2';

describe('SVC-AI-ADV-R638 PublicCloudCostAllocatorV2', () => {
  let svc: PublicCloudCostAllocatorV2;

  beforeEach(() => {
    svc = new PublicCloudCostAllocatorV2();
  });

  it('FR-R638.1: 부서 등록', () => {
    svc.registerDepartment('dept-a', 1000);
    expect(svc.getAllocation('dept-a')).toBe(0);
  });

  it('FR-R638.2: C등급 차단', () => {
    svc.registerDepartment('dept-a', 1000);
    expect(() => svc.recordUsage('dept-a', 100, 'C')).toThrow(/BLOCKED.*N2SF N-05/);
  });

  it('FR-R638.3: 배분 금액 합산', () => {
    svc.registerDepartment('dept-a', 1000);
    svc.recordUsage('dept-a', 300);
    svc.recordUsage('dept-a', 250);
    expect(svc.getAllocation('dept-a')).toBe(550);
  });

  it('FR-R638.4: 초과 사용 부서 탐지', () => {
    svc.registerDepartment('dept-a', 500);
    svc.registerDepartment('dept-b', 1000);
    svc.recordUsage('dept-a', 600);
    svc.recordUsage('dept-b', 400);
    const over = svc.getOverBudgetDepartments();
    expect(over.map((d) => d.deptId)).toEqual(['dept-a']);
  });

  it('FR-R638.5: 감사 로그 기록', () => {
    svc.registerDepartment('dept-a', 500);
    svc.recordUsage('dept-a', 100);
    const log = svc.getAuditLog();
    expect(log.some((e) => e.action === 'RECORD_USAGE')).toBe(true);
  });
});
