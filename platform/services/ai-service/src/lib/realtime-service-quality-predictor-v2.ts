// Design Ref: §예측등급 — cpuRisk&&memRisk:CRITICAL / cpu||mem||errRate>sla:WARNING / STABLE
// Plan SC: SC-R568-1, SC-R568-2, SC-R568-3

interface QualityPredictorInput {
  serviceId: string;
  cpuTrend: number[];
  memTrend: number[];
  currentErrorRate: number;
  slaTarget: number;
}

type QualityPrediction = 'CRITICAL' | 'WARNING' | 'STABLE';

interface QualityPredictResult {
  serviceId: string;
  cpuRisk: boolean;
  memRisk: boolean;
  prediction: QualityPrediction;
  recommendation: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  serviceId: string;
  prediction: QualityPrediction;
}

export class RealtimeServiceQualityPredictorV2 {
  private readonly auditLog: AuditEntry[] = [];

  predict(input: QualityPredictorInput): QualityPredictResult {
    const { serviceId, cpuTrend, memTrend, currentErrorRate, slaTarget } = input;

    const cpuAvg = this.lastThreeAvg(cpuTrend);
    const memAvg = this.lastThreeAvg(memTrend);
    const cpuRisk = cpuAvg > 70;
    const memRisk = memAvg > 80;

    const prediction = this.classify(cpuRisk, memRisk, currentErrorRate, slaTarget);
    const recommendation = this.buildRecommendation(prediction);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'QUALITY_PREDICTED',
      serviceId,
      prediction,
    });

    return { serviceId, cpuRisk, memRisk, prediction, recommendation };
  }

  private lastThreeAvg(trend: number[]): number {
    const slice = trend.slice(-3);
    if (slice.length === 0) return 0;
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  }

  private classify(cpuRisk: boolean, memRisk: boolean, errorRate: number, slaTarget: number): QualityPrediction {
    if (cpuRisk && memRisk) return 'CRITICAL';
    if (cpuRisk || memRisk || errorRate > slaTarget) return 'WARNING';
    return 'STABLE';
  }

  private buildRecommendation(prediction: QualityPrediction): string {
    if (prediction === 'CRITICAL') return '즉시 스케일아웃 및 트래픽 제한이 필요합니다.';
    if (prediction === 'WARNING') return '리소스 모니터링 강화 및 예비 용량 확보를 권고합니다.';
    return '현재 서비스 품질이 안정적입니다.';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
