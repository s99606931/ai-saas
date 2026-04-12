// 시계열 이상 탐지 앙상블 — FR-N402.1~5

export interface TimePoint {
  timestamp: number;
  value: number;
}

export interface AnomalyVerdict {
  point: TimePoint;
  isAnomaly: boolean;
  confidence: number;
  votes: Record<string, boolean>;
  reason: string;
}

export interface Detector {
  name: string;
  detect(series: TimePoint[], point: TimePoint): boolean;
}

export class ZScoreDetector implements Detector {
  readonly name = 'zscore';
  constructor(private readonly threshold = 3) {}
  detect(series: TimePoint[], point: TimePoint): boolean {
    if (series.length < 5) return false;
    const values = series.map((p) => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);
    if (std === 0) return false;
    return Math.abs((point.value - mean) / std) > this.threshold;
  }
}

export class EwmaDetector implements Detector {
  readonly name = 'ewma';
  constructor(private readonly alpha = 0.3, private readonly k = 3) {}
  detect(series: TimePoint[], point: TimePoint): boolean {
    if (series.length < 5) return false;
    let ewma = series[0]?.value ?? 0;
    let variance = 0;
    for (let i = 1; i < series.length; i++) {
      const v = series[i]?.value ?? 0;
      const diff = v - ewma;
      ewma = ewma + this.alpha * diff;
      variance = (1 - this.alpha) * (variance + this.alpha * diff * diff);
    }
    const std = Math.sqrt(variance);
    if (std === 0) return false;
    return Math.abs(point.value - ewma) > this.k * std;
  }
}

export class SeasonalDetector implements Detector {
  readonly name = 'seasonal';
  constructor(private readonly threshold = 2.5) {}
  detect(series: TimePoint[], point: TimePoint): boolean {
    const hour = new Date(point.timestamp).getHours();
    const sameHour = series.filter((p) => new Date(p.timestamp).getHours() === hour);
    if (sameHour.length < 3) return false;
    const values = sameHour.map((p) => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    if (std === 0) return false;
    return Math.abs((point.value - mean) / std) > this.threshold;
  }
}

export class AnomalyEnsemble {
  constructor(private readonly detectors: Detector[], private readonly minVotes = 2) {
    if (detectors.length === 0) throw new Error('ENSEMBLE_NO_DETECTORS');
    if (minVotes <= 0 || minVotes > detectors.length) {
      throw new Error('ENSEMBLE_INVALID_MIN_VOTES');
    }
  }

  detect(series: TimePoint[], point: TimePoint): AnomalyVerdict {
    const votes: Record<string, boolean> = {};
    let trueVotes = 0;
    for (const d of this.detectors) {
      const v = d.detect(series, point);
      votes[d.name] = v;
      if (v) trueVotes += 1;
    }
    const isAnomaly = trueVotes >= this.minVotes;
    const confidence = trueVotes / this.detectors.length;
    const positive = Object.entries(votes)
      .filter(([, v]) => v)
      .map(([k]) => k);
    return {
      point,
      isAnomaly,
      confidence: Number(confidence.toFixed(3)),
      votes,
      reason: isAnomaly ? `${positive.join(',')} 탐지` : '정상',
    };
  }
}
