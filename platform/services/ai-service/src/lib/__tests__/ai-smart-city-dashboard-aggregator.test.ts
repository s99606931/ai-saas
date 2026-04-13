import { describe, it, expect, beforeEach } from 'vitest';
import { AISmartCityDashboardAggregator } from '../ai-smart-city-dashboard-aggregator';

describe('AISmartCityDashboardAggregator', () => {
  let agg: AISmartCityDashboardAggregator;

  beforeEach(() => {
    agg = new AISmartCityDashboardAggregator();
  });

  it('지표를 등록한다', () => {
    agg.registerMetric('seoul', {
      domain: 'traffic', name: 'congestion', value: 80, unit: 'score', weight: 0.5, reportedAt: '2026-04-13',
    });
    expect(agg.getAuditLog().some(l => l.action === 'REGISTER_METRIC')).toBe(true);
  });

  it('가중 평균으로 도메인 점수를 계산한다', () => {
    agg.registerMetric('seoul', { domain: 'traffic', name: 'a', value: 80, unit: 's', weight: 0.5, reportedAt: 't' });
    agg.registerMetric('seoul', { domain: 'traffic', name: 'b', value: 60, unit: 's', weight: 0.5, reportedAt: 't' });
    const snap = agg.aggregate('seoul');
    expect(snap.domainScores.traffic).toBe(70);
  });

  it('복합 지수를 산출한다', () => {
    agg.registerMetric('seoul', { domain: 'traffic', name: 'a', value: 80, unit: 's', weight: 1, reportedAt: 't' });
    agg.registerMetric('seoul', { domain: 'energy', name: 'b', value: 60, unit: 's', weight: 1, reportedAt: 't' });
    const snap = agg.aggregate('seoul');
    expect(snap.compositeIndex).toBe(70);
  });

  it('최신 스냅샷을 조회한다', () => {
    agg.registerMetric('seoul', { domain: 'safety', name: 'a', value: 90, unit: 's', weight: 1, reportedAt: 't' });
    agg.aggregate('seoul');
    const latest = agg.getLatestSnapshot('seoul');
    expect(latest?.cityId).toBe('seoul');
  });

  it('지표 없으면 에러를 던진다', () => {
    expect(() => agg.aggregate('unknown')).toThrow();
  });

  it('C등급 데이터를 차단한다', () => {
    expect(() => agg.registerMetric('seoul', {
      domain: 'welfare', name: 'a', value: 50, unit: 's', weight: 1, reportedAt: 't',
    }, 'C' as unknown as never)).toThrow(/BLOCKED/);
  });
});
