import { describe, it, expect, beforeEach } from 'vitest';
import { BudgetExecutionAnalyzer, type BudgetEntry } from '../microservice-decomposition-advisor-ai';

describe('BudgetExecutionAnalyzer', () => {
  let analyzer: BudgetExecutionAnalyzer;

  beforeEach(() => {
    analyzer = new BudgetExecutionAnalyzer();
  });

  it('marks OVER when spent > allocated', () => {
    const entries: BudgetEntry[] = [
      { dept: 'IT', item: 'Server', allocated: 1000000, spent: 1200000, monthsElapsed: 6, monthsTotal: 12 },
    ];
    const result = analyzer.analyze(entries);
    expect(result.entries[0]!.warning).toBe('OVER');
  });

  it('marks CARRYOVER_RISK when near year end with low exec rate', () => {
    const entries: BudgetEntry[] = [
      { dept: 'HR', item: 'Training', allocated: 1000000, spent: 500000, monthsElapsed: 10, monthsTotal: 12 },
    ];
    const result = analyzer.analyze(entries);
    // execRate=0.5, remainingMonths=2, execRate<0.7 → CARRYOVER_RISK
    expect(result.entries[0]!.warning).toBe('CARRYOVER_RISK');
  });

  it('marks UNDER when significantly behind expected rate', () => {
    const entries: BudgetEntry[] = [
      { dept: 'Ops', item: 'Maintenance', allocated: 1000000, spent: 100000, monthsElapsed: 6, monthsTotal: 12 },
    ];
    const result = analyzer.analyze(entries);
    // execRate=0.1, expectedRate=0.5 → diff=0.4>0.2 → UNDER
    expect(result.entries[0]!.warning).toBe('UNDER');
  });

  it('marks NONE for on-track execution', () => {
    const entries: BudgetEntry[] = [
      { dept: 'Finance', item: 'Audit', allocated: 1000000, spent: 500000, monthsElapsed: 6, monthsTotal: 12 },
    ];
    const result = analyzer.analyze(entries);
    // execRate=0.5, expectedRate=0.5 → NONE
    expect(result.entries[0]!.warning).toBe('NONE');
  });

  it('groups dept summaries correctly', () => {
    const entries: BudgetEntry[] = [
      { dept: 'IT', item: 'Server', allocated: 1000000, spent: 500000, monthsElapsed: 6, monthsTotal: 12 },
      { dept: 'IT', item: 'Software', allocated: 500000, spent: 250000, monthsElapsed: 6, monthsTotal: 12 },
    ];
    const result = analyzer.analyze(entries);
    expect(result.deptSummaries).toHaveLength(1);
    expect(result.deptSummaries[0]!.dept).toBe('IT');
    expect(result.deptSummaries[0]!.avgExecRate).toBeCloseTo(0.5, 2);
  });

  it('records audit log', () => {
    analyzer.analyze([
      { dept: 'A', item: 'X', allocated: 100, spent: 50, monthsElapsed: 3, monthsTotal: 12 },
    ]);
    const log = analyzer.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.action).toBe('budget.analyze');
  });
});
