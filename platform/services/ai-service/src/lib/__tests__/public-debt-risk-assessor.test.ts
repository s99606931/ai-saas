import { describe, it, expect } from 'vitest';
import { PublicDebtRiskAssessor } from '../public-debt-risk-assessor.js';

describe('SVC-AI-ADV-R456 PublicDebtRiskAssessor', () => {
  const svc = new PublicDebtRiskAssessor();

  it('FR-456.4: CRITICAL', () => {
    const r = svc.assess([
      {
        region: 'A',
        debtRatio: 0.9,
        repaymentRatio: 0.9,
        reserveRatio: 0.1,
      },
    ]);
    // 0.45 + 0.27 + 0.18 = 0.9
    expect(r[0]!.grade).toBe('CRITICAL');
  });

  it('FR-456.4: WARNING', () => {
    const r = svc.assess([
      {
        region: 'A',
        debtRatio: 0.6,
        repaymentRatio: 0.5,
        reserveRatio: 0.5,
      },
    ]);
    // 0.3 + 0.15 + 0.1 = 0.55
    expect(r[0]!.grade).toBe('WARNING');
  });

  it('FR-456.4: CAUTION', () => {
    const r = svc.assess([
      {
        region: 'A',
        debtRatio: 0.3,
        repaymentRatio: 0.3,
        reserveRatio: 0.5,
      },
    ]);
    // 0.15 + 0.09 + 0.1 = 0.34
    expect(r[0]!.grade).toBe('CAUTION');
  });

  it('FR-456.4: SAFE', () => {
    const r = svc.assess([
      {
        region: 'A',
        debtRatio: 0.1,
        repaymentRatio: 0.1,
        reserveRatio: 0.9,
      },
    ]);
    // 0.05 + 0.03 + 0.02 = 0.1
    expect(r[0]!.grade).toBe('SAFE');
  });

  it('FR-456.5: debtRatio 범위 오류', () => {
    expect(() =>
      svc.assess([
        {
          region: 'A',
          debtRatio: 1.5,
          repaymentRatio: 0.5,
          reserveRatio: 0.5,
        },
      ]),
    ).toThrow('INVALID_DEBTRATIO');
  });

  it('region 없음 오류', () => {
    expect(() =>
      svc.assess([
        {
          region: '',
          debtRatio: 0.5,
          repaymentRatio: 0.5,
          reserveRatio: 0.5,
        },
      ]),
    ).toThrow('INVALID_REGION');
  });

  it('FR-456.6: C 차단', () => {
    expect(() => svc.assess([], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.assess([]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
