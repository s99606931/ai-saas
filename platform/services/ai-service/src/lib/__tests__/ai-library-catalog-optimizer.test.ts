import { describe, it, expect, beforeEach } from 'vitest';
import { AILibraryCatalogOptimizer } from '../ai-library-catalog-optimizer';

describe('AILibraryCatalogOptimizer', () => {
  let ai: AILibraryCatalogOptimizer;

  beforeEach(() => {
    ai = new AILibraryCatalogOptimizer();
  });

  it('도서 등록', () => {
    ai.registerBook({
      isbn: '978-1',
      category: 'literature',
      acquisitionYear: 2020,
      copies: 3,
      totalLoans12m: 30,
      lastBorrowedDaysAgo: 10,
      conditionScore: 80,
    });
    expect(ai.getAuditLog().some(l => l.action === 'REGISTER_BOOK')).toBe(true);
  });

  it('고수요 도서는 acquire_more 추천', () => {
    ai.registerBook({
      isbn: '978-2',
      category: 'children',
      acquisitionYear: 2023,
      copies: 2,
      totalLoans12m: 80, // lpc = 40
      lastBorrowedDaysAgo: 3,
      conditionScore: 90,
    });
    const r = ai.optimizeCatalog('rep1');
    expect(r.actions[0]!.action).toBe('acquire_more');
    expect(r.highDemandCount).toBe(1);
  });

  it('장기 미대출 + 상태 불량은 discard', () => {
    ai.registerBook({
      isbn: '978-3',
      category: 'history',
      acquisitionYear: 1995,
      copies: 1,
      totalLoans12m: 0,
      lastBorrowedDaysAgo: 400,
      conditionScore: 20,
    });
    const r = ai.optimizeCatalog('rep1');
    expect(r.actions[0]!.action).toBe('discard');
    expect(r.deadStockCount).toBe(1);
  });

  it('장기 미대출 + 양호 상태는 digitize', () => {
    ai.registerBook({
      isbn: '978-4',
      category: 'science',
      acquisitionYear: 2015,
      copies: 1,
      totalLoans12m: 0,
      lastBorrowedDaysAgo: 400,
      conditionScore: 85,
    });
    const r = ai.optimizeCatalog('rep1');
    expect(r.actions.find(a => a.isbn === '978-4')!.action).toBe('digitize');
  });

  it('정상 대출량은 retain', () => {
    ai.registerBook({
      isbn: '978-5',
      category: 'tech',
      acquisitionYear: 2022,
      copies: 5,
      totalLoans12m: 10, // lpc = 2
      lastBorrowedDaysAgo: 15,
      conditionScore: 70,
    });
    const r = ai.optimizeCatalog('rep1');
    expect(r.actions[0]!.action).toBe('retain');
  });

  it('S등급 차단', () => {
    expect(() => ai.optimizeCatalog('rep1', 'S' as unknown as never)).toThrow(/BLOCKED/);
  });
});
