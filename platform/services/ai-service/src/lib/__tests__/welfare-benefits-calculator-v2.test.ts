import { describe, it, expect } from 'vitest';
import { WelfareBenefitsCalculatorV2 } from '../welfare-benefits-calculator-v2.js';

describe('SVC-AI-ADV-R434 WelfareBenefitsCalculatorV2', () => {
  const svc = new WelfareBenefitsCalculatorV2();

  it('FR-434.2~3: 충돌 시 더 큰 금액 선택', () => {
    const r = svc.calculate([
      { id: 'A', amount: 100, excludes: ['B'] },
      { id: 'B', amount: 200, excludes: [] },
      { id: 'C', amount: 50, excludes: [] },
    ]);
    expect(r.selected).toContain('B');
    expect(r.selected).toContain('C');
    expect(r.selected).not.toContain('A');
    expect(r.totalAmount).toBe(250);
  });

  it('FR-434.2: 충돌쌍 반환', () => {
    const r = svc.calculate([
      { id: 'A', amount: 100, excludes: ['B'] },
      { id: 'B', amount: 200, excludes: [] },
    ]);
    expect(r.conflicts.length).toBe(1);
    expect(r.conflicts[0]).toEqual(['A', 'B']);
  });

  it('FR-434.4: 충돌 없을 때 모두 선택', () => {
    const r = svc.calculate([
      { id: 'A', amount: 100, excludes: [] },
      { id: 'B', amount: 200, excludes: [] },
    ]);
    expect(r.selected.length).toBe(2);
    expect(r.totalAmount).toBe(300);
  });

  it('FR-434.5: C 차단', () => {
    expect(() => svc.calculate([], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('20개 초과 → 오류', () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      id: `B${i}`,
      amount: 100,
      excludes: [] as string[],
    }));
    expect(() => svc.calculate(items)).toThrow('TOO_MANY_BENEFITS');
  });

  it('감사 로그', () => {
    svc.calculate([{ id: 'A', amount: 100, excludes: [] }]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
