// SVC-AI-ADV-R473 Public Service Performance AI
// Design Ref: SVC-AI-ADV-R473.design.md §서비스성과
// Plan SC: FR-473.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface ServiceMetric {
  readonly serviceId: string;
  readonly avgProcessingDays: number;
  readonly satisfactionScore: number; // 0..5
  readonly completionRate: number; // 0..1
  readonly complaintsPer1000: number;
  readonly costPerCaseKrw: number;
}

export interface PerformanceReport {
  readonly serviceId: string;
  readonly efficiency: number;
  readonly quality: number;
  readonly costEffectiveness: number;
  readonly overall: number;
  readonly tier: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_IMPROVEMENT';
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 성과 데이터 차단 (N2SF N-05)`);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export class PublicServicePerformanceAi {
  private readonly auditLog: AuditEntry[] = [];

  evaluate(metric: ServiceMetric, grade: DataGrade = 'O'): PerformanceReport {
    block(grade);

    const proc = Math.max(0.1, metric.avgProcessingDays);
    const efficiency = clamp(100 - proc * 2, 0, 100) * clamp(metric.completionRate, 0, 1);

    const sat = clamp(metric.satisfactionScore, 0, 5);
    const quality = clamp(sat * 20 - metric.complaintsPer1000 * 2, 0, 100);

    const cost = Math.max(1, metric.costPerCaseKrw);
    const costEff = clamp(100 - Math.log10(cost) * 10, 0, 100);

    const overall = Number(
      (efficiency * 0.4 + quality * 0.4 + costEff * 0.2).toFixed(2),
    );

    const tier: PerformanceReport['tier'] =
      overall >= 80
        ? 'EXCELLENT'
        : overall >= 60
          ? 'GOOD'
          : overall >= 40
            ? 'FAIR'
            : 'NEEDS_IMPROVEMENT';

    this.appendAudit('SERVICE_PERF_EVAL', {
      serviceId: metric.serviceId,
      overall,
      tier,
    });

    return {
      serviceId: metric.serviceId,
      efficiency: Number(efficiency.toFixed(2)),
      quality: Number(quality.toFixed(2)),
      costEffectiveness: Number(costEff.toFixed(2)),
      overall,
      tier,
    };
  }

  rank(metrics: readonly ServiceMetric[]): readonly PerformanceReport[] {
    const reports = metrics.map((m) => this.evaluate(m));
    return [...reports].sort((a, b) => b.overall - a.overall);
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  }
}
