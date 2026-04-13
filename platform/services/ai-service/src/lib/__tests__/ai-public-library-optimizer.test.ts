import { describe, it, expect, beforeEach } from 'vitest';
import { AIPublicLibraryOptimizer } from '../ai-public-library-optimizer';

describe('AIPublicLibraryOptimizer', () => {
  let svc: AIPublicLibraryOptimizer;

  beforeEach(() => {
    svc = new AIPublicLibraryOptimizer();
    svc.recordCirculation({ bookId: 'b1', category: 'fiction', monthYYYYMM: '2026-01', loanCount: 10, reservationCount: 1 });
    svc.recordCirculation({ bookId: 'b1', category: 'fiction', monthYYYYMM: '2026-02', loanCount: 14, reservationCount: 2 });
    svc.recordCirculation({ bookId: 'b1', category: 'fiction', monthYYYYMM: '2026-03', loanCount: 20, reservationCount: 4 });
    svc.recordCirculation({ bookId: 'b2', category: 'science', monthYYYYMM: '2026-03', loanCount: 5, reservationCount: 0 });
  });

  it('도서 기록을 저장한다', () => {
    expect(svc.getAuditLog().filter(e => e.action === 'RECORD_CIRCULATION').length).toBe(4);
  });

  it('상승 트렌드를 감지한다', () => {
    const f = svc.forecastDemand('b1');
    expect(f.trend).toBe('up');
    expect(f.forecastNextMonthLoans).toBeGreaterThan(10);
  });

  it('재고 부족 시 acquire 권장', () => {
    const advice = svc.adviseInventory('b1', 1);
    expect(advice.action).toBe('acquire');
    expect(advice.suggestedCopies).toBeGreaterThan(1);
  });

  it('재고 적정 시 maintain', () => {
    const advice = svc.adviseInventory('b2', 2);
    expect(advice.action).toBe('maintain');
  });

  it('인기 카테고리 순위를 산출한다', () => {
    const ranks = svc.rankPopularCategories('2026-03');
    expect(ranks[0]?.category).toBe('fiction');
    expect(ranks.length).toBeGreaterThan(0);
  });

  it('C등급 데이터를 차단한다', () => {
    expect(() => svc.recordCirculation({ bookId: 'b3', category: 'history', monthYYYYMM: '2026-03', loanCount: 3, reservationCount: 0 }, 'C')).toThrow('BLOCKED');
  });
});
