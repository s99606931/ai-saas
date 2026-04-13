/**
 * AI 공공재정 최적화기 단위 테스트 — SVC-AI-ADV-R476
 * Plan SC: FR-476.1~6
 */

import { describe, it, expect } from 'vitest';
import { AiPublicFinanceOptimizer } from '../ai-public-finance-optimizer';
import type { BudgetItem } from '../ai-public-finance-optimizer';

const mk = (
  id: string,
  requested: number,
  priority: number,
  mandatory = false,
): BudgetItem => ({
  id,
  category: 'general',
  requested,
  priorityScore: priority,
  mandatory,
});

describe('AiPublicFinanceOptimizer — R476', () => {
  it('FR-476.1: 필수 항목 우선 배정', () => {
    const opt = new AiPublicFinanceOptimizer();
    const r = opt.optimize(
      [mk('M', 1000, 50, true), mk('A', 500, 90), mk('B', 500, 10)],
      1500,
    );
    const m = r.allocations.find((a) => a.id === 'M')!;
    expect(m.allocated).toBe(1000);
  });

  it('FR-476.2: 예산 부족 시 할당 제한', () => {
    const opt = new AiPublicFinanceOptimizer();
    const r = opt.optimize([mk('A', 1000, 50)], 200);
    const a = r.allocations.find((x) => x.id === 'A')!;
    expect(a.allocated).toBeLessThanOrEqual(200);
  });

  it('FR-476.3: 우선순위 높은 optional 먼저 할당', () => {
    const opt = new AiPublicFinanceOptimizer();
    const r = opt.optimize([mk('L', 500, 10), mk('H', 500, 90)], 500);
    const h = r.allocations.find((a) => a.id === 'H')!;
    const l = r.allocations.find((a) => a.id === 'L')!;
    expect(h.allocated).toBeGreaterThanOrEqual(l.allocated);
  });

  it('FR-476.4: 음수 예산 거부', () => {
    const opt = new AiPublicFinanceOptimizer();
    expect(() => opt.optimize([], -1)).toThrow();
  });

  it('FR-476.5: audit 로그', () => {
    const opt = new AiPublicFinanceOptimizer();
    opt.optimize([mk('A', 100, 50)], 100);
    expect(opt.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-476.6: C/S 차단', () => {
    const opt = new AiPublicFinanceOptimizer();
    expect(() => opt.optimize([mk('A', 1, 1)], 1, 'C')).toThrow(/N2SF_BLOCKED/);
  });
});
