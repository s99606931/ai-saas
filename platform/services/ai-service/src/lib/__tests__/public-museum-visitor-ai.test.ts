import { describe, it, expect, beforeEach } from 'vitest';
import { PublicMuseumVisitorAI } from '../public-museum-visitor-ai';

describe('PublicMuseumVisitorAI', () => {
  let ai: PublicMuseumVisitorAI;

  beforeEach(() => {
    ai = new PublicMuseumVisitorAI();
    ai.registerExhibit({ exhibitId: 'e1', title: '조선 왕실', category: 'history', avgDwellTimeMin: 15, popularity: 90 });
    ai.registerExhibit({ exhibitId: 'e2', title: '현대 미술', category: 'art', avgDwellTimeMin: 10, popularity: 70 });
    ai.registerExhibit({ exhibitId: 'e3', title: '우주 탐사', category: 'science', avgDwellTimeMin: 20, popularity: 85 });
  });

  it('전시를 등록하고 방문을 기록한다', () => {
    ai.recordVisit({ visitorId: 'v1', exhibitId: 'e1', dwellTimeMin: 18 });
    expect(ai.getAuditLog().some(a => a.action === 'RECORD_VISIT')).toBe(true);
  });

  it('방문자에게 미방문 전시를 추천한다', () => {
    ai.recordVisit({ visitorId: 'v1', exhibitId: 'e1', dwellTimeMin: 20 });
    const recs = ai.recommend('v1');
    expect(recs.some(r => r.exhibitId === 'e1')).toBe(false);
    expect(recs.length).toBeGreaterThan(0);
  });

  it('인기 전시를 반환한다', () => {
    const popular = ai.popularExhibits(2);
    expect(popular[0]?.exhibitId).toBe('e1');
    expect(popular.length).toBe(2);
  });

  it('카테고리별 평균 체류 시간을 계산한다', () => {
    ai.recordVisit({ visitorId: 'v1', exhibitId: 'e1', dwellTimeMin: 20 });
    ai.recordVisit({ visitorId: 'v2', exhibitId: 'e1', dwellTimeMin: 10 });
    const avg = ai.avgDwellByCategory();
    expect(avg.history).toBe(15);
  });

  it('알 수 없는 전시 방문은 거부한다', () => {
    expect(() => ai.recordVisit({ visitorId: 'v1', exhibitId: 'xxx', dwellTimeMin: 5 })).toThrow('미등록');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerExhibit(
        { exhibitId: 'ex', title: 'T', category: 'culture', avgDwellTimeMin: 5, popularity: 50 },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
