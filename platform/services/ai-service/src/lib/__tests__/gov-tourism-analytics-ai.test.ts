import { describe, it, expect, beforeEach } from 'vitest';
import { GovTourismAnalyticsAI } from '../gov-tourism-analytics-ai';

describe('GovTourismAnalyticsAI', () => {
  let svc: GovTourismAnalyticsAI;

  beforeEach(() => {
    svc = new GovTourismAnalyticsAI();
    svc.recordVisit({ attractionId: 'a1', region: '제주', monthYYYYMM: '2026-01', visitorCount: 1000, averageStayHours: 3, averageSpendKrw: 50000 });
    svc.recordVisit({ attractionId: 'a1', region: '제주', monthYYYYMM: '2026-07', visitorCount: 5000, averageStayHours: 4, averageSpendKrw: 70000 });
    svc.recordVisit({ attractionId: 'a2', region: '제주', monthYYYYMM: '2026-07', visitorCount: 2000, averageStayHours: 2, averageSpendKrw: 30000 });
  });

  it('방문 데이터를 기록한다', () => {
    expect(svc.getAuditLog().filter(e => e.action === 'RECORD_VISIT').length).toBe(3);
  });

  it('계절성 분석 — 피크월 식별', () => {
    const report = svc.computeSeasonality('a1');
    expect(report.peakMonth).toBe('2026-07');
    expect(report.lowMonth).toBe('2026-01');
    expect(report.seasonalityIndex).toBeGreaterThan(0);
  });

  it('지역 요약 통계', () => {
    const summary = svc.computeRegionalSummary('제주', '2026-07');
    expect(summary.totalVisitors).toBe(7000);
    expect(summary.totalRevenueKrw).toBe(5000 * 70000 + 2000 * 30000);
  });

  it('관광지 방문객 순위', () => {
    const ranks = svc.rankAttractions('2026-07');
    expect(ranks[0]?.attractionId).toBe('a1');
  });

  it('데이터 부족 시 오류', () => {
    expect(() => svc.computeSeasonality('unknown')).toThrow('데이터 부족');
  });

  it('S등급 데이터 차단', () => {
    expect(() => svc.recordVisit({ attractionId: 'a3', region: '강원', monthYYYYMM: '2026-04', visitorCount: 100, averageStayHours: 2, averageSpendKrw: 20000 }, 'S')).toThrow('BLOCKED');
  });
});
