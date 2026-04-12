import { describe, it, expect } from 'vitest';
import {
  AnomalyEnsemble,
  ZScoreDetector,
  EwmaDetector,
  SeasonalDetector,
  type TimePoint,
} from '../timeseries-anomaly-ensemble.js';

describe('AnomalyEnsemble', () => {
  const ensemble = new AnomalyEnsemble([new ZScoreDetector(2), new EwmaDetector(0.3, 2)], 2);

  const series: TimePoint[] = Array.from({ length: 20 }, (_, i) => ({
    timestamp: i * 3600_000,
    value: 10 + (i % 3),
  }));

  it('정상 포인트', () => {
    const r = ensemble.detect(series, { timestamp: 21 * 3600_000, value: 11 });
    expect(r.isAnomaly).toBe(false);
  });

  it('명백한 이상', () => {
    const r = ensemble.detect(series, { timestamp: 21 * 3600_000, value: 1000 });
    expect(r.isAnomaly).toBe(true);
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('계절성 탐지기 통합', () => {
    const ens = new AnomalyEnsemble([new SeasonalDetector(1.5), new ZScoreDetector(2)], 1);
    const r = ens.detect(series, { timestamp: 22 * 3600_000, value: 500 });
    expect(r.isAnomaly).toBe(true);
  });

  it('탐지기 없음 거부', () => {
    expect(() => new AnomalyEnsemble([], 1)).toThrow('ENSEMBLE_NO_DETECTORS');
  });

  it('투표수 초과 거부', () => {
    expect(() => new AnomalyEnsemble([new ZScoreDetector()], 5)).toThrow('ENSEMBLE_INVALID_MIN_VOTES');
  });
});
