import { describe, it, expect, beforeEach } from 'vitest';
import { FinancialAuditAutomator, type Expense } from '../service-catalog-curator-v2';

describe('FinancialAuditAutomator', () => {
  let auditor: FinancialAuditAutomator;

  beforeEach(() => {
    auditor = new FinancialAuditAutomator();
  });

  it('flags OVER_LIMIT for travel expense exceeding 500000', () => {
    const expenses: Expense[] = [
      { id: 'E1', amount: 600000, category: 'travel', evidence: ['receipt.pdf'], date: '2026-04-01' },
    ];
    const result = auditor.audit(expenses);
    expect(result.findings[0]!.reasons).toContain('OVER_LIMIT');
    expect(result.findings[0]!.risk).toBe('HIGH');
  });

  it('flags NO_EVIDENCE when evidence array is empty', () => {
    const expenses: Expense[] = [
      { id: 'E2', amount: 50000, category: 'meal', evidence: [], date: '2026-04-01' },
    ];
    const result = auditor.audit(expenses);
    expect(result.findings[0]!.reasons).toContain('NO_EVIDENCE');
    expect(result.findings[0]!.risk).toBe('MED');
  });

  it('flags DUPLICATE for same category+date+amount pair', () => {
    const expenses: Expense[] = [
      { id: 'E3', amount: 50000, category: 'meal', evidence: ['r.pdf'], date: '2026-04-02' },
      { id: 'E4', amount: 50000, category: 'meal', evidence: ['r2.pdf'], date: '2026-04-02' },
    ];
    const result = auditor.audit(expenses);
    const dup = result.findings.find(f => f.id === 'E4');
    expect(dup?.reasons).toContain('DUPLICATE');
    expect(dup?.risk).toBe('HIGH');
  });

  it('returns no findings for valid expenses', () => {
    const expenses: Expense[] = [
      { id: 'E5', amount: 100000, category: 'office', evidence: ['inv.pdf'], date: '2026-04-03' },
    ];
    const result = auditor.audit(expenses);
    expect(result.findings).toHaveLength(0);
    expect(result.flagged).toBe(0);
  });

  it('counts total and flagged correctly', () => {
    const expenses: Expense[] = [
      { id: 'E6', amount: 50000, category: 'meal', evidence: [], date: '2026-04-04' },
      { id: 'E7', amount: 50000, category: 'meal', evidence: ['r.pdf'], date: '2026-04-05' },
    ];
    const result = auditor.audit(expenses);
    expect(result.total).toBe(2);
    expect(result.flagged).toBe(1);
  });

  it('records audit log', () => {
    auditor.audit([
      { id: 'E8', amount: 200000, category: 'travel', evidence: ['e.pdf'], date: '2026-04-06' },
    ]);
    const log = auditor.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.action).toBe('financial.audit');
  });
});
