// SVC-AI-ADV-R355 AI Capacity Planner v2
// Design Ref: SVC-AI-ADV-R355.design.md
// Plan SC: SC-R355-1~4
// CSAP: D-06 감사, N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface CapacityRecommendation {
  readonly action: 'scale-out' | 'scale-in' | 'hold';
  readonly delta: number;
  readonly predicted: number;
  readonly reason: string;
}

export interface PlannerConfig {
  readonly targetUtilization: number;
  readonly lowWatermark: number;
  readonly perNodeCapacity: number;
  readonly windowSize: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class AiCapacityPlannerV2 {
  private readonly auditLog: AuditEntry[] = [];

  plan(
    samples: readonly number[],
    config: PlannerConfig,
    grade: DataGrade = 'O',
  ): CapacityRecommendation {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 인프라 메트릭 전송 금지 (N2SF N-05)`);
    }
    if (samples.length === 0) {
      throw new Error('INVALID_PARAMS: samples empty');
    }

    const window = samples.slice(-config.windowSize);
    const sum = window.reduce((acc, v) => acc + v, 0);
    const predicted = sum / window.length;

    let recommendation: CapacityRecommendation;
    if (predicted > config.targetUtilization) {
      const overflow = predicted - config.targetUtilization;
      const delta = Math.ceil(overflow / config.perNodeCapacity);
      recommendation = {
        action: 'scale-out',
        delta,
        predicted: Number(predicted.toFixed(4)),
        reason: `predicted ${predicted.toFixed(2)} > target ${config.targetUtilization}`,
      };
    } else if (predicted < config.lowWatermark) {
      recommendation = {
        action: 'scale-in',
        delta: 1,
        predicted: Number(predicted.toFixed(4)),
        reason: `predicted ${predicted.toFixed(2)} < low ${config.lowWatermark}`,
      };
    } else {
      recommendation = {
        action: 'hold',
        delta: 0,
        predicted: Number(predicted.toFixed(4)),
        reason: 'within target band',
      };
    }

    this.record('PLAN', 'capacity', {
      predicted: recommendation.predicted,
      action: recommendation.action,
      delta: recommendation.delta,
    });
    return recommendation;
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
