import { describe, it, expect } from 'vitest';
import { TaxAuditRiskAssessorAI } from '../tax-audit-risk-assessor-ai.js';

describe('SVC-AI-ADV-R435 TaxAuditRiskAssessorAI', () => {
  const svc = new TaxAuditRiskAssessorAI();

  it('FR-435.1~2: 고위험 분류', () => {
    const r = svc.assess([
      { taxpayerId: 'H', cashRatio: 0.9, reportGap: 0.9, industryRisk: 0.9 },
    ]);
    expect(r[0]!.level).toBe('HIGH');
    expect(r[0]!.score).toBeGreaterThanOrEqual(0.7);
  });

  it('FR-435.2: 중·저 위험 분류', () => {
    const r = svc.assess([
      { taxpayerId: 'M', cashRatio: 0.5, reportGap: 0.5, industryRisk: 0.5 },
      { taxpayerId: 'L', cashRatio: 0.1, reportGap: 0.1, industryRisk: 0.1 },
    ]);
    expect(r.find((x) => x.taxpayerId === 'M')!.level).toBe('MEDIUM');
    expect(r.find((x) => x.taxpayerId === 'L')!.level).toBe('LOW');
  });

  it('FR-435.4: HIGH 우선 정렬', () => {
    const r = svc.assess([
      { taxpayerId: 'L', cashRatio: 0.1, reportGap: 0.1, industryRisk: 0.1 },
      { taxpayerId: 'H', cashRatio: 0.9, reportGap: 0.9, industryRisk: 0.9 },
    ]);
    expect(r[0]!.taxpayerId).toBe('H');
  });

  it('FR-435.3: topFactors 반환', () => {
    const r = svc.assess([
      { taxpayerId: 'X', cashRatio: 1, reportGap: 0, industryRisk: 0.1 },
    ]);
    expect(r[0]!.topFactors[0]).toBe('cashRatio');
  });

  it('범위 초과 → 오류', () => {
    expect(() =>
      svc.assess([{ taxpayerId: 'X', cashRatio: 1.5, reportGap: 0, industryRisk: 0 }]),
    ).toThrow('INVALID_RANGE');
  });

  it('FR-435.5: C 차단', () => {
    expect(() => svc.assess([], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.assess([{ taxpayerId: 'X', cashRatio: 0.5, reportGap: 0.5, industryRisk: 0.5 }]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
