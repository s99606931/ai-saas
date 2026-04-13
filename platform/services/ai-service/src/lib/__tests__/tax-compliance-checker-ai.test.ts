import { describe, it, expect } from 'vitest';
import { TaxComplianceCheckerAI } from '../tax-compliance-checker-ai.js';

describe('SVC-AI-ADV-R425 TaxComplianceCheckerAI', () => {
  const svc = new TaxComplianceCheckerAI();

  it('FR-425.4: 정상 신고 → compliant=true', () => {
    const r = svc.check({
      filingId: 'f1',
      taxpayerId: 'T100',
      income: 50000000,
      deduction: 5000000,
      declaredTax: 5000000,
      calculatedTax: 5000000,
    });
    expect(r.compliant).toBe(true);
    expect(r.issues.length).toBe(0);
  });

  it('FR-425.1: 납세자 ID 누락 → CRITICAL', () => {
    const r = svc.check({
      filingId: 'f2',
      taxpayerId: '',
      income: 10000000,
      deduction: 0,
      declaredTax: 1000000,
      calculatedTax: 1000000,
    });
    expect(r.issues.some((i) => i.severity === 'CRITICAL')).toBe(true);
    expect(r.compliant).toBe(false);
  });

  it('FR-425.2: 과다공제 → HIGH', () => {
    const r = svc.check({
      filingId: 'f3',
      taxpayerId: 'T',
      income: 10000000,
      deduction: 6000000, // 60%
      declaredTax: 400000,
      calculatedTax: 400000,
    });
    expect(r.issues.some((i) => i.code === 'OVER_DEDUCTION')).toBe(true);
    expect(r.compliant).toBe(false);
  });

  it('FR-425.3: 계산 오차 > 100 → MEDIUM', () => {
    const r = svc.check({
      filingId: 'f4',
      taxpayerId: 'T',
      income: 10000000,
      deduction: 1000000,
      declaredTax: 900000,
      calculatedTax: 1000000,
    });
    expect(r.issues.some((i) => i.code === 'CALC_MISMATCH')).toBe(true);
    // MEDIUM만 있으면 compliant는 true
    expect(r.compliant).toBe(true);
  });

  it('FR-425.5: C 등급 차단', () => {
    expect(() =>
      svc.check(
        {
          filingId: 'f',
          taxpayerId: 'T',
          income: 0,
          deduction: 0,
          declaredTax: 0,
          calculatedTax: 0,
        },
        'C',
      ),
    ).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.check({
      filingId: 'f99',
      taxpayerId: 'T',
      income: 1000,
      deduction: 0,
      declaredTax: 100,
      calculatedTax: 100,
    });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
