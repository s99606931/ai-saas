// SVC-AI-ADV-R366 AI Model Explainability v2
// Design Ref: SVC-AI-ADV-R366.design.md
// Plan SC: SC-R366-1~4
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Feature {
  readonly name: string;
  readonly value: number;
  readonly weight: number;
}

export interface FeatureContribution {
  readonly name: string;
  readonly contribution: number;
  readonly normalized: number;
}

export interface ExplanationResult {
  readonly prediction: number;
  readonly topFeatures: readonly FeatureContribution[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class AiModelExplainabilityV2 {
  private readonly auditLog: AuditEntry[] = [];

  explain(
    features: readonly Feature[],
    topN = 5,
    grade: DataGrade = 'O',
  ): ExplanationResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 모델 설명 차단 (N2SF N-05)`);
    }
    if (features.length === 0) {
      throw new Error('INVALID_PARAMS: empty features');
    }
    if (topN <= 0) {
      throw new Error('INVALID_PARAMS: topN must be positive');
    }

    const contributions = features.map((f) => ({
      name: f.name,
      contribution: f.value * f.weight,
    }));

    const totalAbs = contributions.reduce((s, c) => s + Math.abs(c.contribution), 0);
    const prediction = contributions.reduce((s, c) => s + c.contribution, 0);

    const normalized: FeatureContribution[] = contributions.map((c) => ({
      name: c.name,
      contribution: Number(c.contribution.toFixed(4)),
      normalized: totalAbs === 0 ? 0 : Number((Math.abs(c.contribution) / totalAbs).toFixed(4)),
    }));

    normalized.sort((a, b) => b.normalized - a.normalized);
    const top = normalized.slice(0, topN);

    const result: ExplanationResult = {
      prediction: Number(prediction.toFixed(4)),
      topFeatures: top,
    };

    this.record('EXPLAIN', 'model', {
      prediction: result.prediction,
      topCount: top.length,
    });

    return result;
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
