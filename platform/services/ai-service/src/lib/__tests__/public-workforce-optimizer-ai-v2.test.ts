import { describe, it, expect, beforeEach } from 'vitest';
import { PublicWorkforceOptimizerAIV2 } from '../public-workforce-optimizer-ai-v2';

describe('PublicWorkforceOptimizerAIV2', () => {
  let svc: PublicWorkforceOptimizerAIV2;

  beforeEach(() => {
    svc = new PublicWorkforceOptimizerAIV2();
    svc.registerDepartment({ deptId: 'd1', name: '복지부', headcount: 10 });
  });

  it('classifies OVERLOADED + HIRE for >=40 cases per capita', () => {
    const a = svc.reportLoad({ loadId: 'l', deptId: 'd1', casesPerDay: 500, avgOvertimeHours: 0 });
    expect(a.level).toBe('OVERLOADED');
    expect(a.action).toBe('HIRE');
  });

  it('classifies BUSY + REASSIGN for 25~40 per capita', () => {
    const a = svc.reportLoad({ loadId: 'l', deptId: 'd1', casesPerDay: 300, avgOvertimeHours: 0 });
    expect(a.level).toBe('BUSY');
    expect(a.action).toBe('REASSIGN');
  });

  it('classifies NORMAL + HOLD for < 25 per capita', () => {
    const a = svc.reportLoad({ loadId: 'l', deptId: 'd1', casesPerDay: 100, avgOvertimeHours: 0 });
    expect(a.level).toBe('NORMAL');
    expect(a.action).toBe('HOLD');
  });

  it('escalates one rank when avgOvertimeHours >= 4', () => {
    const a = svc.reportLoad({ loadId: 'l', deptId: 'd1', casesPerDay: 100, avgOvertimeHours: 5 });
    expect(a.action).toBe('REASSIGN');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      svc.reportLoad({ loadId: 'l', deptId: 'd1', casesPerDay: 100, avgOvertimeHours: 0 }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      svc.reportLoad({ loadId: 'l', deptId: 'd1', casesPerDay: 100, avgOvertimeHours: 0 }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown dept and invalid load', () => {
    expect(() =>
      svc.reportLoad({ loadId: 'l', deptId: 'unknown', casesPerDay: 10, avgOvertimeHours: 0 }),
    ).toThrow('UNKNOWN_DEPT');
    expect(() =>
      svc.reportLoad({ loadId: 'l', deptId: 'd1', casesPerDay: -1, avgOvertimeHours: 0 }),
    ).toThrow('INVALID_LOAD');
    expect(() => svc.registerDepartment({ deptId: 'x', name: 'x', headcount: 0 })).toThrow(
      'INVALID_HEADCOUNT',
    );
  });

  it('lists hire recommendations and maintains audit log', () => {
    svc.reportLoad({ loadId: 'l1', deptId: 'd1', casesPerDay: 500, avgOvertimeHours: 0 });
    svc.reportLoad({ loadId: 'l2', deptId: 'd1', casesPerDay: 50, avgOvertimeHours: 0 });
    expect(svc.getHireRecommendations().map((a) => a.loadId)).toEqual(['l1']);
    expect(svc.getAuditLog().some((e) => e.action === 'REPORT_LOAD')).toBe(true);
  });
});
