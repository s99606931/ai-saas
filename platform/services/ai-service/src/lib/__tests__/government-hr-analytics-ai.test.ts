import { describe, it, expect, beforeEach } from 'vitest';
import { GovernmentHRAnalyticsAI } from '../government-hr-analytics-ai';

describe('GovernmentHRAnalyticsAI', () => {
  let hr: GovernmentHRAnalyticsAI;

  beforeEach(() => {
    hr = new GovernmentHRAnalyticsAI();
  });

  it('직원을 등록한다', () => {
    hr.registerEmployee({
      id: 'e1', department: '기획', hireYear: 2020, performanceScore: 85,
      overtimeHoursMonth: 15, trainingHoursYear: 20,
    });
    expect(hr.getAuditLog().some(l => l.action === 'REGISTER_EMPLOYEE')).toBe(true);
  });

  it('부서 KPI를 계산한다', () => {
    hr.registerEmployee({
      id: 'e1', department: '재정', hireYear: 2018, performanceScore: 80,
      overtimeHoursMonth: 10, trainingHoursYear: 30,
    });
    hr.registerEmployee({
      id: 'e2', department: '재정', hireYear: 2022, performanceScore: 70,
      overtimeHoursMonth: 20, trainingHoursYear: 15,
    });
    const kpi = hr.computeDepartmentKpi('재정');
    expect(kpi.headcount).toBe(2);
    expect(kpi.avgPerformance).toBe(75);
  });

  it('과로 직원은 이탈 리스크가 높다', () => {
    hr.registerEmployee({
      id: 'e1', department: '안전', hireYear: 2025, performanceScore: 45,
      overtimeHoursMonth: 50, trainingHoursYear: 5,
    });
    const risk = hr.getEmployeeRisk('e1');
    expect(risk).toBeGreaterThanOrEqual(60);
  });

  it('고위험 직원을 식별한다', () => {
    hr.registerEmployee({
      id: 'e1', department: '복지', hireYear: 2025, performanceScore: 40,
      overtimeHoursMonth: 50, trainingHoursYear: 5,
    });
    const list = hr.identifyHighRiskEmployees(60);
    expect(list).toContain('e1');
  });

  it('부서에 직원 없으면 0 반환', () => {
    const kpi = hr.computeDepartmentKpi('문화');
    expect(kpi.headcount).toBe(0);
  });

  it('S등급을 차단한다', () => {
    expect(() => hr.registerEmployee({
      id: 'e1', department: '기획', hireYear: 2020, performanceScore: 80,
      overtimeHoursMonth: 10, trainingHoursYear: 20,
    }, 'S' as unknown as never)).toThrow(/BLOCKED/);
  });
});
