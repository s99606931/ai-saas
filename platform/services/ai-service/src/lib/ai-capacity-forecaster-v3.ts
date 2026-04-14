// Design Ref: SVC-AI-ADV-R689.design.md — AI기반 용량 예측 자동화 v3
// Plan SC: FR-R689.1~5

export type ForecastVerdict = 'EXPAND' | 'WATCH' | 'HEALTHY';

export interface ForecastResult {
  predicted: number;
  slope: number;
  weeksAhead: number;
  verdict: ForecastVerdict;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details?: Record<string, unknown>;
}

export class AiCapacityForecasterV3 {
  private readonly auditLog: AuditEntry[] = [];

  forecast(
    samples: readonly number[],
    weeksAhead: number,
    threshold: number,
    dataGrade?: string,
  ): ForecastResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (samples.length < 3) {
      throw new Error('INSUFFICIENT_SAMPLES');
    }
    if (weeksAhead <= 0) {
      throw new Error('INVALID_WEEKS');
    }

    const n = samples.length;
    const first3 = samples.slice(0, 3);
    const last3 = samples.slice(-3);
    const firstAvg = first3.reduce((a, b) => a + b, 0) / 3;
    const lastAvg = last3.reduce((a, b) => a + b, 0) / 3;
    const slope = (lastAvg - firstAvg) / Math.max(1, n - 3);

    const last = samples[n - 1]!;
    const predicted = Number((last + slope * weeksAhead).toFixed(4));

    let verdict: ForecastVerdict;
    if (predicted >= threshold) {
      verdict = 'EXPAND';
    } else if (predicted >= threshold * 0.8) {
      verdict = 'WATCH';
    } else {
      verdict = 'HEALTHY';
    }

    const result: ForecastResult = {
      predicted,
      slope: Number(slope.toFixed(4)),
      weeksAhead,
      verdict,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'FORECAST',
      details: { predicted, weeksAhead, threshold, verdict },
    });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
