import { describe, it, expect } from 'vitest';
import { BudgetAnalyzerAi, type BudgetLineItem } from '../budget-analyzer-ai.js';

describe('BudgetAnalyzerAi', () => {
  const analyzer = new BudgetAnalyzerAi();

  const items: BudgetLineItem[] = [
    { accountCode: '110', accountName: '인건비', type: 'expense', planned: 10000, executed: 9500, fiscalYear: 2026, category: '인건' },
    { accountCode: '210', accountName: '운영비', type: 'expense', planned: 5000, executed: 6000, fiscalYear: 2026, category: '운영' },
    { accountCode: '310', accountName: '사업비', type: 'expense', planned: 20000, executed: 1000, fiscalYear: 2026, category: '사업' },
  ];

  it('집행률 계산', () => {
    const r = analyzer.analyze(items);
    expect(r.totalPlanned).toBe(35000);
    expect(r.totalExecuted).toBe(16500);
  });

  it('초과 집행 탐지', () => {
    const r = analyzer.analyze(items);
    const over = r.anomalies.find((a) => a.kind === 'over_budget');
    expect(over).toBeDefined();
  });

  it('미집행 탐지', () => {
    const r = analyzer.analyze(items);
    const under = r.anomalies.find((a) => a.kind === 'under_execution');
    expect(under?.severity).toBe('high');
  });

  it('YoY 증가 탐지', () => {
    const prev = [{ ...items[0]!, planned: 5000 }];
    const r = analyzer.compareYoy({ previous: prev, current: [items[0]!] });
    expect(r[0]?.kind).toBe('yoy_spike');
  });

  it('빈 입력 거부', () => {
    expect(() => analyzer.analyze([])).toThrow('BUDGET_EMPTY');
  });
});
