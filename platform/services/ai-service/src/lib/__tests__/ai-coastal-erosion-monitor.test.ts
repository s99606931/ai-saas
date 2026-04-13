import { describe, it, expect, beforeEach } from 'vitest';
import { CoastalErosionMonitor } from '../ai-coastal-erosion-monitor';

describe('CoastalErosionMonitor', () => {
  let ai: CoastalErosionMonitor;

  beforeEach(() => {
    ai = new CoastalErosionMonitor();
  });

  it('시계열 데이터 부족 시 에러', () => {
    ai.addReading({
      siteId: 's1',
      at: '2020-01-01T00:00:00Z',
      shorelineMeters: 100,
      beachWidthMeters: 30,
      waveHeightMeters: 1,
    });
    expect(() => ai.assess('s1')).toThrow('부족');
  });

  it('정상 해안선 안정 판정', () => {
    ai.addReading({ siteId: 's1', at: '2020-01-01T00:00:00Z', shorelineMeters: 100, beachWidthMeters: 30, waveHeightMeters: 1 });
    ai.addReading({ siteId: 's1', at: '2025-01-01T00:00:00Z', shorelineMeters: 99.8, beachWidthMeters: 29.8, waveHeightMeters: 1 });
    const r = ai.assess('s1');
    expect(r.severity).toBe('stable');
  });

  it('심각한 침식 판정 및 대피 권고', () => {
    ai.addReading({ siteId: 's2', at: '2020-01-01T00:00:00Z', shorelineMeters: 100, beachWidthMeters: 30, waveHeightMeters: 1 });
    ai.addReading({ siteId: 's2', at: '2025-01-01T00:00:00Z', shorelineMeters: 80, beachWidthMeters: 10, waveHeightMeters: 4 });
    const r = ai.assess('s2');
    expect(r.severity).toBe('critical');
    expect(r.actions.some(a => a.includes('대피'))).toBe(true);
  });

  it('10년 예측 손실 계산', () => {
    ai.addReading({ siteId: 's3', at: '2020-01-01T00:00:00Z', shorelineMeters: 50, beachWidthMeters: 20, waveHeightMeters: 1 });
    ai.addReading({ siteId: 's3', at: '2024-01-01T00:00:00Z', shorelineMeters: 44, beachWidthMeters: 14, waveHeightMeters: 1 });
    const r = ai.assess('s3');
    expect(r.projectedLossMetersIn10Y).toBeGreaterThan(0);
  });

  it('사이트 목록', () => {
    ai.addReading({ siteId: 's1', at: '2020-01-01T00:00:00Z', shorelineMeters: 100, beachWidthMeters: 30, waveHeightMeters: 1 });
    expect(ai.listSites().length).toBe(1);
  });

  it('C등급 차단', () => {
    expect(() =>
      ai.addReading(
        { siteId: 's1', at: '2020-01-01T00:00:00Z', shorelineMeters: 100, beachWidthMeters: 30, waveHeightMeters: 1 },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
