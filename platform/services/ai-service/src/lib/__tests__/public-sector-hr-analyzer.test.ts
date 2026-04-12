import { describe, it, expect } from 'vitest';
import { PublicSectorHrAnalyzer, type HrRecord } from '../public-sector-hr-analyzer.js';

describe('SVC-AI-ADV-R357 PublicSectorHrAnalyzer', () => {
  const svc = new PublicSectorHrAnalyzer();

  const base: HrRecord = {
    employeeId: 'e1',
    deptId: 'd1',
    grade: 'O',
    skillScore: 80,
    performance: 4,
    tenureYears: 5,
    trainingHours: 20,
    absenceDays: 2,
    salaryPercentile: 60,
  };

  it('FR-357.1: 역량 갭 계산', () => {
    const records: HrRecord[] = [base, { ...base, employeeId: 'e2', skillScore: 60 }];
    const out = svc.analyze(records);
    expect(out[0]?.gap).toBeLessThanOrEqual(0);
    expect(out[1]?.gap).toBeGreaterThan(0);
  });

  it('FR-357.2: 이직 위험 산출', () => {
    const risky: HrRecord = {
      ...base,
      employeeId: 'eR',
      performance: 2,
      tenureYears: 1,
      trainingHours: 0,
      absenceDays: 20,
      salaryPercentile: 20,
    };
    const out = svc.analyze([risky]);
    expect(out[0]?.turnoverRisk).toBe(100);
    expect(out[0]?.flags.length).toBeGreaterThan(3);
  });

  it('FR-357.3: C/S 차단', () => {
    const s: HrRecord = { ...base, grade: 'S' };
    expect(() => svc.analyze([s])).toThrow('N2SF_BLOCKED');
  });

  it('FR-357.4: 감사 로그', () => {
    svc.analyze([base]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('안전 인력은 위험 낮음', () => {
    const out = svc.analyze([base]);
    expect(out[0]?.turnoverRisk).toBe(0);
    expect(out[0]?.flags.length).toBe(0);
  });
});
