import { describe, it, expect, beforeEach } from 'vitest';
import { AIHeritageTourismOptimizer } from '../ai-heritage-tourism-optimizer';

describe('AIHeritageTourismOptimizer', () => {
  let opt: AIHeritageTourismOptimizer;

  beforeEach(() => {
    opt = new AIHeritageTourismOptimizer();
    opt.registerSite({
      id: 'gyeongbok', name: '경복궁', category: 'palace', dailyCapacity: 10000,
      averageVisitMinutes: 90, popularityScore: 95,
    });
    opt.registerSite({
      id: 'bulguksa', name: '불국사', category: 'temple', dailyCapacity: 5000,
      averageVisitMinutes: 60, popularityScore: 85,
    });
  });

  it('사이트를 등록한다', () => {
    expect(opt.getAuditLog().some(l => l.action === 'REGISTER_SITE')).toBe(true);
  });

  it('방문 기록을 저장한다', () => {
    opt.recordVisit({ siteId: 'gyeongbok', date: '2026-04-13', visitorCount: 5000 });
    expect(opt.getSiteOccupancy('gyeongbok', '2026-04-13')).toBe(0.5);
  });

  it('혼잡한 사이트는 high 리스크', () => {
    opt.recordVisit({ siteId: 'gyeongbok', date: '2026-04-13', visitorCount: 9000 });
    const tour = opt.recommendTour(['gyeongbok'], '2026-04-13');
    expect(tour.crowdingRisk).toBe('high');
  });

  it('투어 순서는 점수 내림차순', () => {
    const tour = opt.recommendTour(['bulguksa', 'gyeongbok'], '2026-04-13');
    expect(tour.siteOrder[0]).toBe('gyeongbok');
  });

  it('총 예상 시간을 계산한다', () => {
    const tour = opt.recommendTour(['gyeongbok', 'bulguksa'], '2026-04-13');
    // 90 + 60 + 30 이동시간 = 180
    expect(tour.estimatedTotalMinutes).toBe(180);
  });

  it('C등급 방문 기록을 차단한다', () => {
    expect(() => opt.recordVisit({
      siteId: 'gyeongbok', date: '2026-04-13', visitorCount: 100,
    }, 'C' as unknown as never)).toThrow(/BLOCKED/);
  });
});
