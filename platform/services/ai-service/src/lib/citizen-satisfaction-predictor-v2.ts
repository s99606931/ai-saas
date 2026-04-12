// SVC-AI-ADV-R368 Citizen Satisfaction Predictor v2
// Design Ref: SVC-AI-ADV-R368.design.md
// Plan SC: SC-R368-1~4
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface ServiceQualityMetrics {
  readonly responseTime: number; // 0~100 (정규화 후, 높을수록 좋음)
  readonly resolutionRate: number; // 0~100
  readonly courtesy: number; // 0~100
}

export interface Weakness {
  readonly metric: string;
  readonly score: number;
}

export interface SatisfactionResult {
  readonly serviceId: string;
  readonly score: number;
  readonly grade: 'A' | 'B' | 'C' | 'D';
  readonly weaknesses: readonly Weakness[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class CitizenSatisfactionPredictorV2 {
  private readonly auditLog: AuditEntry[] = [];

  predict(
    serviceId: string,
    metrics: ServiceQualityMetrics,
    grade: DataGrade = 'O',
  ): SatisfactionResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 만족도 데이터 차단 (N2SF N-05)`);
    }
    this.validate(metrics);

    const score = Number(
      (
        metrics.responseTime * 0.3 +
        metrics.resolutionRate * 0.4 +
        metrics.courtesy * 0.3
      ).toFixed(2),
    );

    let letter: 'A' | 'B' | 'C' | 'D';
    if (score >= 85) letter = 'A';
    else if (score >= 70) letter = 'B';
    else if (score >= 50) letter = 'C';
    else letter = 'D';

    const items: Weakness[] = [
      { metric: 'responseTime', score: metrics.responseTime },
      { metric: 'resolutionRate', score: metrics.resolutionRate },
      { metric: 'courtesy', score: metrics.courtesy },
    ];
    items.sort((a, b) => a.score - b.score);
    const weaknesses = items.slice(0, 3);

    const result: SatisfactionResult = {
      serviceId,
      score,
      grade: letter,
      weaknesses,
    };

    this.record('PREDICT', serviceId, { score, grade: letter });

    return result;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private validate(m: ServiceQualityMetrics): void {
    for (const [k, v] of Object.entries(m)) {
      if (v < 0 || v > 100) {
        throw new Error(`INVALID_PARAMS: ${k} out of 0~100`);
      }
    }
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
