import { describe, it, expect, beforeEach } from 'vitest';
import { MunicipalDebtRiskAssessor, type Finance } from '../service-quality-auto-adjuster-v2';

describe('MunicipalDebtRiskAssessor', () => {
  let assessor: MunicipalDebtRiskAssessor;

  beforeEach(() => {
    assessor = new MunicipalDebtRiskAssessor();
  });

  it('grades SAFE for low debt ratios and high reserve', () => {
    const finances: Finance[] = [
      { region: 'Seoul', debtRatio: 0.1, repaymentRatio: 0.1, reserveRatio: 0.9 },
    ];
    const results = assessor.assess(finances);
    expect(results[0]!.grade).toBe('SAFE');
    expect(results[0]!.score).toBeLessThan(25);
  });

  it('grades CRITICAL for high debt, high repayment, low reserve', () => {
    const finances: Finance[] = [
      { region: 'X-City', debtRatio: 0.9, repaymentRatio: 0.9, reserveRatio: 0.0 },
    ];
    const results = assessor.assess(finances);
    expect(results[0]!.grade).toBe('CRITICAL');
    expect(results[0]!.score).toBeGreaterThanOrEqual(75);
  });

  it('grades CAUTION for moderate risk', () => {
    const finances: Finance[] = [
      { region: 'B-City', debtRatio: 0.3, repaymentRatio: 0.3, reserveRatio: 0.5 },
    ];
    const results = assessor.assess(finances);
    expect(results[0]!.grade).toBe('CAUTION');
  });

  it('returns region name in result', () => {
    const finances: Finance[] = [
      { region: 'Busan', debtRatio: 0.2, repaymentRatio: 0.2, reserveRatio: 0.7 },
    ];
    const results = assessor.assess(finances);
    expect(results[0]!.region).toBe('Busan');
  });

  it('handles multiple regions', () => {
    const finances: Finance[] = [
      { region: 'R1', debtRatio: 0.1, repaymentRatio: 0.1, reserveRatio: 0.9 },
      { region: 'R2', debtRatio: 0.9, repaymentRatio: 0.9, reserveRatio: 0.0 },
    ];
    const results = assessor.assess(finances);
    expect(results).toHaveLength(2);
    const r1 = results.find(r => r.region === 'R1')!;
    const r2 = results.find(r => r.region === 'R2')!;
    expect(r1.score).toBeLessThan(r2.score);
  });

  it('records audit log', () => {
    assessor.assess([
      { region: 'Test', debtRatio: 0.5, repaymentRatio: 0.5, reserveRatio: 0.3 },
    ]);
    const log = assessor.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.action).toBe('debt.assess');
  });
});
