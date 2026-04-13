import { describe, it, expect } from 'vitest';
import { PublicFinanceAuditAI } from '../public-finance-audit-ai.js';

describe('SVC-AI-ADV-R449 PublicFinanceAuditAI', () => {
  const svc = new PublicFinanceAuditAI();

  it('FR-449.3: 한도 초과', () => {
    const r = svc.audit([
      {
        id: 'e1',
        amount: 600000,
        category: 'travel',
        evidence: ['receipt'],
        date: '2026-04-01',
      },
    ]);
    expect(r.findings[0]!.reasons).toContain('OVER_LIMIT');
    expect(r.findings[0]!.risk).toBe('HIGH');
  });

  it('FR-449.3: 증빙 누락', () => {
    const r = svc.audit([
      { id: 'e1', amount: 50000, category: 'meal', evidence: [], date: '2026-04-01' },
    ]);
    expect(r.findings[0]!.reasons).toContain('NO_EVIDENCE');
  });

  it('FR-449.4: 중복 탐지', () => {
    const r = svc.audit([
      {
        id: 'e1',
        amount: 50000,
        category: 'meal',
        evidence: ['r'],
        date: '2026-04-01',
      },
      {
        id: 'e2',
        amount: 50000,
        category: 'meal',
        evidence: ['r'],
        date: '2026-04-01',
      },
    ]);
    expect(r.flagged).toBe(2);
    expect(r.findings[0]!.reasons).toContain('DUPLICATE');
  });

  it('정상 건 필터링', () => {
    const r = svc.audit([
      {
        id: 'e1',
        amount: 30000,
        category: 'meal',
        evidence: ['r'],
        date: '2026-04-01',
      },
    ]);
    expect(r.flagged).toBe(0);
  });

  it('amount 음수 → 오류', () => {
    expect(() =>
      svc.audit([
        {
          id: 'e1',
          amount: -1,
          category: 'meal',
          evidence: ['r'],
          date: '2026-04-01',
        },
      ]),
    ).toThrow('INVALID_AMOUNT');
  });

  it('FR-449.5: C 차단', () => {
    expect(() => svc.audit([], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.audit([]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
