// Design Ref: §SVC-AI-ADV-R476 — AI기반 서비스 용량 예측 v2
// Plan SC: FR-R476.1~5

export type Window = 'day' | 'week' | 'month';
export type ServiceStatus = 'OVERLOADED' | 'WARNING' | 'HEALTHY';

export interface CapacityMetric {
  readonly serviceId: string;
  readonly cpuUsage: number;
  readonly memUsage: number;
  readonly requestRate: number;
  readonly window: Window;
  readonly growthRate: number;
}

export interface CapacityForecast {
  readonly serviceId: string;
  readonly status: ServiceStatus;
  readonly recommendedCapacity: number;
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class ServiceCapacityPredictorV2 {
  private readonly auditLog: AuditEvent[] = [];

  private classifyStatus(cpuUsage: number, memUsage: number): ServiceStatus {
    if (cpuUsage > 80 || memUsage > 80) return 'OVERLOADED';
    if (cpuUsage > 60 || memUsage > 60) return 'WARNING';
    return 'HEALTHY';
  }

  predict(metrics: readonly CapacityMetric[]): readonly CapacityForecast[] {
    const forecasts: CapacityForecast[] = metrics.map(m => {
      const status = this.classifyStatus(m.cpuUsage, m.memUsage);
      const recommendedCapacity = Math.round(m.requestRate * (1 + m.growthRate * 1.2));
      return { serviceId: m.serviceId, status, recommendedCapacity };
    });

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'capacity.predict',
      details: {
        serviceCount: metrics.length,
        overloadedCount: forecasts.filter(f => f.status === 'OVERLOADED').length,
      },
    });

    return forecasts;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
