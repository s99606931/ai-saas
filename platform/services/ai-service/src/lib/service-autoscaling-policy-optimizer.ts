// Design Ref: §SVC-AI-ADV-R511 — AI기반 서비스 자동 스케일링 정책 최적화
// Plan SC: FR-R511.1~5

export type ScaleAction = 'SCALE_OUT' | 'SCALE_IN' | 'MAINTAIN';
export type SloRisk = 'HIGH_RISK' | 'LOW_RISK';

export interface ScalingMetric {
  readonly serviceId: string;
  readonly cpuAvg: number;
  readonly memAvg: number;
  readonly rpsAvg: number;
  readonly rpsP95: number;
  readonly sloTarget: number;
}

export interface ScalingPolicy {
  readonly serviceId: string;
  readonly action: ScaleAction;
  readonly recommendedInstances: number;
  readonly sloRisk: SloRisk;
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class ServiceAutoscalingPolicyOptimizer {
  private readonly auditLog: AuditEvent[] = [];

  private determineAction(m: ScalingMetric): ScaleAction {
    if (m.rpsP95 > m.rpsAvg * 2 || m.cpuAvg > 75) return 'SCALE_OUT';
    if (m.cpuAvg < 30 && m.memAvg < 30) return 'SCALE_IN';
    return 'MAINTAIN';
  }

  optimize(metrics: readonly ScalingMetric[]): readonly ScalingPolicy[] {
    const policies: ScalingPolicy[] = metrics.map(m => {
      const action = this.determineAction(m);
      const base = Math.ceil(m.rpsAvg / 100);
      const buffer = action === 'SCALE_OUT' ? 2 : action === 'SCALE_IN' ? -1 : 0;
      const recommendedInstances = Math.max(1, base + buffer);
      const sloRisk: SloRisk =
        m.sloTarget < 0.99 && action === 'SCALE_IN' ? 'HIGH_RISK' : 'LOW_RISK';
      return { serviceId: m.serviceId, action, recommendedInstances, sloRisk };
    });

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'autoscaling.optimize',
      details: {
        serviceCount: metrics.length,
        scaleOutCount: policies.filter(p => p.action === 'SCALE_OUT').length,
        highRiskCount: policies.filter(p => p.sloRisk === 'HIGH_RISK').length,
      },
    });

    return policies;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
