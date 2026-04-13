import { describe, it, expect, beforeEach } from 'vitest';
import { AiPopulationTrendAnalyzer, type PopulationSnapshot } from '../ai-population-trend-analyzer';

describe('AiPopulationTrendAnalyzer', () => {
  let ai: AiPopulationTrendAnalyzer;

  beforeEach(() => {
    ai = new AiPopulationTrendAnalyzer();
  });

  const snap = (over: Partial<PopulationSnapshot> = {}): PopulationSnapshot => ({
    regionCode: 'KR-11',
    year: 2025,
    totalPopulation: 100_000,
    under15: 12_000,
    age15to64: 70_000,
    over65: 18_000,
    births: 800,
    deaths: 1_000,
    inMigration: 1_500,
    outMigration: 1_200,
    ...over,
  });

  it('데이터 없는 지역 분석은 오류이다', () => {
    expect(() => ai.analyze('UNKNOWN')).toThrow('NOT_FOUND');
  });

  it('고령화지수와 부양비를 계산한다', () => {
    ai.ingest(snap());
    const result = ai.analyze('KR-11');
    expect(result.agingIndex).toBe(150);
    expect(result.dependencyRatio).toBeCloseTo(42.86, 1);
  });

  it('5% 이상 감소는 depopulating이다', () => {
    ai.ingest(snap({ year: 2024, totalPopulation: 100_000 }));
    ai.ingest(snap({ year: 2025, totalPopulation: 90_000 }));
    const result = ai.analyze('KR-11');
    expect(result.populationCategory).toBe('depopulating');
  });

  it('1% 이상 증가는 growing이다', () => {
    ai.ingest(snap({ year: 2024, totalPopulation: 100_000 }));
    ai.ingest(snap({ year: 2025, totalPopulation: 102_000 }));
    const result = ai.analyze('KR-11');
    expect(result.populationCategory).toBe('growing');
  });

  it('자연증가와 사회증가로 다음 해를 예측한다', () => {
    ai.ingest(snap());
    const result = ai.analyze('KR-11');
    expect(result.forecastNextYear).toBe(100_000 + (800 - 1000) + (1500 - 1200));
  });

  it('S등급 데이터는 차단된다', () => {
    expect(() => ai.ingest(snap(), 'S')).toThrow('BLOCKED');
  });
});
