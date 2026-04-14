// Design Ref: SVC-AI-ADV-R639.design.md §설계결정
// Plan SC: FR-R639.1~5
// 트랙 B 23차

interface ServiceRecord { serviceId: string; tier: string }
interface MetricSample { latencyMs: number; errorRate: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ServiceMeshTelemetryAiV2 {
  private services = new Map<string, ServiceRecord>();
  private metrics = new Map<string, MetricSample[]>();
  private auditLog: AuditEntry[] = [];

  registerService(serviceId: string, tier: string): void {
    this.services.set(serviceId, { serviceId, tier });
    if (!this.metrics.has(serviceId)) this.metrics.set(serviceId, []);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_SERVICE',
      details: { serviceId, tier },
    });
  }

  recordMetric(
    serviceId: string,
    latencyMs: number,
    errorRate: number,
    dataGrade?: string,
  ): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
    }
    const list = this.metrics.get(serviceId) ?? [];
    list.push({ latencyMs, errorRate });
    this.metrics.set(serviceId, list);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_METRIC',
      details: { serviceId, latencyMs, errorRate },
    });
  }

  getAverageMetrics(serviceId: string): MetricSample | null {
    const list = this.metrics.get(serviceId) ?? [];
    if (list.length === 0) return null;
    const sumLatency = list.reduce((acc, m) => acc + m.latencyMs, 0);
    const sumError = list.reduce((acc, m) => acc + m.errorRate, 0);
    return {
      latencyMs: sumLatency / list.length,
      errorRate: sumError / list.length,
    };
  }

  getSlaViolations(): ServiceRecord[] {
    return Array.from(this.services.values()).filter((s) => {
      const avg = this.getAverageMetrics(s.serviceId);
      if (!avg) return false;
      return avg.latencyMs > 500 || avg.errorRate > 0.05;
    });
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
