import { describe, it, expect } from 'vitest';
import { BudgetExecutionAnalyzerV2 } from '../budget-execution-analyzer-v2.js';

describe('SVC-AI-ADV-R453 BudgetExecutionAnalyzerV2', () => {
  const svc = new BudgetExecutionAnalyzerV2();

  it('FR-453.3: UNDER 경고', () => {
    const r = svc.analyze([
      {
        dept: 'A',
        item: 'i1',
        allocated: 1000,
        spent: 200,
        monthsElapsed: 6,
        monthsTotal: 12,
      },
    ]);
    // expected 0.5, exec 0.2, diff -0.3 → UNDER
    expect(r.entries[0]!.warning).toBe('UNDER');
  });

  it('FR-453.3: OVER 경고', () => {
    const r = svc.analyze([
      {
        dept: 'A',
        item: 'i1',
        allocated: 1000,
        spent: 800,
        monthsElapsed: 6,
        monthsTotal: 12,
      },
    ]);
    // expected 0.5, exec 0.8, diff 0.3 → OVER
    expect(r.entries[0]!.warning).toBe('OVER');
  });

  it('FR-453.4: CARRYOVER_RISK', () => {
    const r = svc.analyze([
      {
        dept: 'A',
        item: 'i1',
        allocated: 1000,
        spent: 500,
        monthsElapsed: 11,
        monthsTotal: 12,
      },
    ]);
    expect(r.entries[0]!.warning).toBe('CARRYOVER_RISK');
  });

  it('FR-453.5: 부서별 집계', () => {
    const r = svc.analyze([
      {
        dept: 'A',
        item: 'i1',
        allocated: 1000,
        spent: 500,
        monthsElapsed: 6,
        monthsTotal: 12,
      },
      {
        dept: 'A',
        item: 'i2',
        allocated: 2000,
        spent: 1000,
        monthsElapsed: 6,
        monthsTotal: 12,
      },
    ]);
    expect(r.deptSummaries.length).toBe(1);
    expect(r.deptSummaries[0]!.avgExecRate).toBe(0.5);
  });

  it('정상 건', () => {
    const r = svc.analyze([
      {
        dept: 'A',
        item: 'i1',
        allocated: 1000,
        spent: 500,
        monthsElapsed: 6,
        monthsTotal: 12,
      },
    ]);
    expect(r.entries[0]!.warning).toBe('NONE');
  });

  it('allocated 0 → 오류', () => {
    expect(() =>
      svc.analyze([
        {
          dept: 'A',
          item: 'i1',
          allocated: 0,
          spent: 0,
          monthsElapsed: 6,
          monthsTotal: 12,
        },
      ]),
    ).toThrow('INVALID_ALLOCATED');
  });

  it('FR-453.6: C 차단', () => {
    expect(() => svc.analyze([], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.analyze([]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
