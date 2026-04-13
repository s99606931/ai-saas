// SVC-AI-ADV-R451 교통 혼잡 예측 AI
// Design Ref: SVC-AI-ADV-R451.design.md
// Plan SC: FR-451.1~7
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Weather = 'clear' | 'rain' | 'snow';
export type Level = 'HIGH' | 'MED' | 'LOW';

export interface TrafficInput {
  readonly roadId: string;
  readonly baseVolume: number;
  readonly hour: number;
  readonly weather: Weather;
  readonly event: boolean;
}

export interface Prediction {
  readonly roadId: string;
  readonly predicted: number;
  readonly ratio: number;
  readonly level: Level;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const WEATHER_FACTOR: Record<Weather, number> = {
  clear: 1.0,
  rain: 1.2,
  snow: 1.5,
};

export class TrafficCongestionPredictorAI {
  private readonly auditLog: AuditEntry[] = [];

  predict(inputs: readonly TrafficInput[], grade: DataGrade = 'O'): readonly Prediction[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 교통 데이터 차단 (N2SF N-05)`);
    }

    const results: Prediction[] = [];
    for (const input of inputs) {
      if (!input.roadId) throw new Error('INVALID_ROAD_ID');
      if (input.baseVolume < 0) throw new Error(`INVALID_BASE: ${input.roadId}`);
      if (input.hour < 0 || input.hour > 23) {
        throw new Error(`INVALID_HOUR: ${input.roadId}`);
      }

      const hourF = this.hourFactor(input.hour);
      const weatherF = WEATHER_FACTOR[input.weather];
      const eventBonus = input.event ? 0.3 : 0;
      const predicted = input.baseVolume * hourF * weatherF * (1 + eventBonus);
      const ratio = input.baseVolume === 0 ? 0 : predicted / input.baseVolume;
      const level: Level = ratio >= 2.0 ? 'HIGH' : ratio >= 1.3 ? 'MED' : 'LOW';

      results.push({
        roadId: input.roadId,
        predicted: Math.round(predicted),
        ratio: Math.round(ratio * 100) / 100,
        level,
      });
    }

    this.record('PREDICT', 'traffic', { count: results.length });
    return results;
  }

  private hourFactor(hour: number): number {
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) return 1.6;
    if (hour >= 10 && hour <= 16) return 1.0;
    return 0.5;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
