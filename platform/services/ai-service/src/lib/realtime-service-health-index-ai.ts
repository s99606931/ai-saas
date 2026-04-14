// Design Ref: §SVC-AI-ADV-R479 — AI기반 실시간 서비스 건강 지수 산출
// Plan SC: FR-R479.1~5

export type HealthGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface ServiceMetrics {
  readonly serviceId: string;
  readonly availability: number;
  readonly latencyScore: number;
  readonly errorScore: number;
  readonly saturationScore: number;
}

export interface HealthIndex {
  readonly serviceId: string;
  readonly index: number;
  readonly grade: HealthGrade;
  readonly weakestMetric: string;
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class RealtimeServiceHealthIndexAI {
  private readonly auditLog: AuditEvent[] = [];

  private computeIndex(m: ServiceMetrics): number {
    return (
      m.availability * 0.4 +
      m.latencyScore * 0.3 +
      m.errorScore * 0.2 +
      m.saturationScore * 0.1
    );
  }

  private gradeFromIndex(index: number): HealthGrade {
    if (index >= 90) return 'EXCELLENT';
    if (index >= 75) return 'GOOD';
    if (index >= 60) return 'FAIR';
    return 'POOR';
  }

  private findWeakest(m: ServiceMetrics): string {
    const metrics = [
      { name: 'availability', value: m.availability },
      { name: 'latencyScore', value: m.latencyScore },
      { name: 'errorScore', value: m.errorScore },
      { name: 'saturationScore', value: m.saturationScore },
    ];
    return metrics.reduce((min, cur) => (cur.value < min.value ? cur : min)).name;
  }

  calculate(services: readonly ServiceMetrics[]): readonly HealthIndex[] {
    const results: HealthIndex[] = services.map(m => {
      const index = Math.round(this.computeIndex(m) * 10) / 10;
      const grade = this.gradeFromIndex(index);
      const weakestMetric = this.findWeakest(m);
      return { serviceId: m.serviceId, index, grade, weakestMetric };
    });

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'health.calculate',
      details: {
        serviceCount: services.length,
        poorCount: results.filter(r => r.grade === 'POOR').length,
        excellentCount: results.filter(r => r.grade === 'EXCELLENT').length,
      },
    });

    return results;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
