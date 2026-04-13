// Design Ref: §SVC-AI-ADV-R451 — 교통 혼잡 예측 AI
// Plan SC: FR-R451.1~5

export type Weather = 'clear' | 'rain' | 'snow';

export interface TrafficInput {
  readonly roadId: string;
  readonly baseVolume: number;
  readonly hour: number;
  readonly weather: Weather;
  readonly event: boolean;
}

export type Level = 'HIGH' | 'MED' | 'LOW';

export interface Prediction {
  readonly roadId: string;
  readonly predicted: number;
  readonly ratio: number;
  readonly level: Level;
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class TrafficCongestionPredictor {
  private readonly auditLog: AuditEvent[] = [];

  private timeFactor(hour: number): number {
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) return 1.6;
    if (hour >= 6 && hour <= 22) return 1.0;
    return 0.5;
  }

  private weatherFactor(w: Weather): number {
    if (w === 'snow') return 1.5;
    if (w === 'rain') return 1.2;
    return 1.0;
  }

  private levelFromRatio(ratio: number): Level {
    if (ratio >= 2.0) return 'HIGH';
    if (ratio >= 1.3) return 'MED';
    return 'LOW';
  }

  predict(inputs: readonly TrafficInput[]): readonly Prediction[] {
    const predictions = inputs.map(inp => {
      let multiplier = this.timeFactor(inp.hour) * this.weatherFactor(inp.weather);
      if (inp.event) multiplier += 0.3;
      const predicted = Math.round(inp.baseVolume * multiplier);
      const ratio = Math.round((multiplier) * 100) / 100;
      const level = this.levelFromRatio(ratio);
      return { roadId: inp.roadId, predicted, ratio, level };
    });

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'traffic.predict',
      details: {
        roadCount: inputs.length,
        highCount: predictions.filter(p => p.level === 'HIGH').length,
      },
    });

    return predictions;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
