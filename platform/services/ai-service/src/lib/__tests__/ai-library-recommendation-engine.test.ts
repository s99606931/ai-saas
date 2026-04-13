import { describe, it, expect, beforeEach } from 'vitest';
import { AILibraryRecommendationEngine } from '../ai-library-recommendation-engine';

describe('AILibraryRecommendationEngine', () => {
  let ai: AILibraryRecommendationEngine;

  beforeEach(() => {
    ai = new AILibraryRecommendationEngine();
    ai.addBook({
      bookId: 'B1',
      title: '소설A',
      author: '김작가',
      categories: ['소설', '문학'],
      available: true,
      popularity: 85,
    });
    ai.addBook({
      bookId: 'B2',
      title: '과학B',
      author: '박과학',
      categories: ['과학'],
      available: true,
      popularity: 60,
    });
    ai.addBook({
      bookId: 'B3',
      title: '소설C',
      author: '김작가',
      categories: ['소설'],
      available: true,
      popularity: 30,
    });
  });

  it('선호 분야 일치 도서를 추천한다', () => {
    ai.registerReader({
      readerId: 'R1',
      preferredCategories: ['소설'],
      readBookIds: [],
      ratings: {},
    });
    const recs = ai.recommend('R1');
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]?.bookId).toBe('B1');
  });

  it('이미 읽은 도서는 추천하지 않는다', () => {
    ai.registerReader({
      readerId: 'R2',
      preferredCategories: ['소설'],
      readBookIds: ['B1'],
      ratings: { B1: 5 },
    });
    const recs = ai.recommend('R2');
    expect(recs.find(r => r.bookId === 'B1')).toBeUndefined();
  });

  it('선호 저자 도서에 가점을 준다', () => {
    ai.registerReader({
      readerId: 'R3',
      preferredCategories: ['소설'],
      readBookIds: ['B1'],
      ratings: { B1: 5 },
    });
    const recs = ai.recommend('R3');
    const b3 = recs.find(r => r.bookId === 'B3');
    expect(b3).toBeDefined();
    expect(b3?.reasons.some(s => s.includes('선호 저자'))).toBe(true);
  });

  it('평점을 기록한다', () => {
    ai.registerReader({
      readerId: 'R4',
      preferredCategories: [],
      readBookIds: [],
      ratings: {},
    });
    ai.rateBook('R4', 'B2', 4);
    expect(ai.getAuditLog().some(l => l.action === 'RATE_BOOK')).toBe(true);
  });

  it('인기 도서 상위 목록을 반환한다', () => {
    const top = ai.getMostPopular(2);
    expect(top.length).toBe(2);
    expect(top[0]?.bookId).toBe('B1');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.addBook(
        {
          bookId: 'X',
          title: 't',
          author: 'a',
          categories: [],
          available: true,
          popularity: 1,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
