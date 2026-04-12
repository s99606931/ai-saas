// FinOps AI 용량 계획 -- FR-N291.1~FR-N291.6
// Design Ref: MTU-N291 | CSAP: D-06

export interface ResourceMetric {
  readonly resourceId: string;
  readonly type: 'cpu' | 'memory' | 'storage' | 'network';
  readonly timestamp: string;
  readonly value: number; // 사용량(%)
  readonly costKrw: number; // 시간당 원화 비용
}

export interface CapacityForecast {
  readonly resourceId: string;
  readonly type: ResourceMetric['type'];
  readonly currentAvgUsage: number;
  readonly forecast30dUsage: number;
  readonly forecast90dUsage: number;
  readonly recommendedAction: 'scale_up' | 'scale_down' | 'maintain';
  readonly confidence: number;
}

export interface CostOptimization {
  readonly resourceId: string;
  readonly currentMonthlyCostKrw: number;
  readonly optimizedMonthlyCostKrw: number;
  readonly savingsKrw: number;
  readonly recommendation: string;
}

export interface FinOpsReport {
  readonly reportId: string;
  readonly periodFrom: string;
  readonly periodTo: string;
  readonly totalCostKrw: number;
  readonly totalSavingsKrw: number;
  readonly forecasts: readonly CapacityForecast[];
  readonly optimizations: readonly CostOptimization[];
  readonly generatedAt: string;
}

export interface FinOpsAuditEntry {
  readonly timestamp: string;
  readonly tenantId: string;
  readonly actor: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: FinOpsAuditEntry[] = [];

function recordAudit(entry: Omit<FinOpsAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getFinOpsAuditLog(tenantId: string): readonly FinOpsAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

// FR-N291.1: 시계열 이동 평균 기반 예측
function movingAverage(values: number[], window: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-window);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function linearTrend(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i] ?? 0;
    const y = values[i] ?? 0;
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function forecastCapacity(metrics: readonly ResourceMetric[]): CapacityForecast | null {
  if (metrics.length === 0) return null;
  const sorted = [...metrics].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const first = sorted[0];
  if (!first) return null;
  const values = sorted.map((m) => m.value);
  const avg = movingAverage(values, Math.min(7, values.length));
  const trend = linearTrend(values);
  const forecast30 = Math.max(0, Math.min(100, avg + trend * 30));
  const forecast90 = Math.max(0, Math.min(100, avg + trend * 90));

  let recommendedAction: 'scale_up' | 'scale_down' | 'maintain' = 'maintain';
  if (forecast30 > 80 || forecast90 > 90) recommendedAction = 'scale_up';
  else if (forecast30 < 30 && forecast90 < 30) recommendedAction = 'scale_down';

  return {
    resourceId: first.resourceId,
    type: first.type,
    currentAvgUsage: avg,
    forecast30dUsage: forecast30,
    forecast90dUsage: forecast90,
    recommendedAction,
    confidence: Math.min(0.95, 0.5 + values.length * 0.02),
  };
}

// FR-N291.2: 비용 최적화 권고
export function optimizeCost(metrics: readonly ResourceMetric[]): CostOptimization | null {
  if (metrics.length === 0) return null;
  const first = metrics[0];
  if (!first) return null;
  const avgUsage = movingAverage(metrics.map((m) => m.value), metrics.length);
  const monthlyCost = metrics.reduce((s, m) => s + m.costKrw, 0) * (24 * 30 / metrics.length);
  let optimized = monthlyCost;
  let recommendation = '현재 구성 유지';
  if (avgUsage < 30) {
    optimized = monthlyCost * 0.6;
    recommendation = '인스턴스 다운사이징 (40% 절감)';
  } else if (avgUsage > 85) {
    optimized = monthlyCost * 1.3;
    recommendation = '리저브드 인스턴스 전환 (장기 절감)';
  }
  return {
    resourceId: first.resourceId,
    currentMonthlyCostKrw: monthlyCost,
    optimizedMonthlyCostKrw: optimized,
    savingsKrw: monthlyCost - optimized,
    recommendation,
  };
}

// FR-N291.3: 통합 리포트 생성
export function generateFinOpsReport(
  tenantId: string,
  actor: string,
  metricsByResource: ReadonlyMap<string, readonly ResourceMetric[]>,
): FinOpsReport {
  const forecasts: CapacityForecast[] = [];
  const optimizations: CostOptimization[] = [];
  let totalCost = 0;
  let totalSavings = 0;

  for (const metrics of metricsByResource.values()) {
    const f = forecastCapacity(metrics);
    if (f) forecasts.push(f);
    const o = optimizeCost(metrics);
    if (o) {
      optimizations.push(o);
      totalCost += o.currentMonthlyCostKrw;
      totalSavings += Math.max(0, o.savingsKrw);
    }
  }

  const allTimestamps = Array.from(metricsByResource.values()).flat().map((m) => m.timestamp).sort();
  const report: FinOpsReport = {
    reportId: `finops-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    periodFrom: allTimestamps[0] ?? new Date().toISOString(),
    periodTo: allTimestamps[allTimestamps.length - 1] ?? new Date().toISOString(),
    totalCostKrw: totalCost,
    totalSavingsKrw: totalSavings,
    forecasts,
    optimizations,
    generatedAt: new Date().toISOString(),
  };

  recordAudit({
    tenantId,
    actor,
    action: 'FINOPS_REPORT_GENERATED',
    target: report.reportId,
    details: { resources: metricsByResource.size, totalCost, totalSavings },
  });

  return report;
}

// FR-N291.6 + Service
export class FinOpsCapacityPlanningService {
  constructor(private readonly tenantId: string) {}

  forecast(metrics: readonly ResourceMetric[]): CapacityForecast | null {
    return forecastCapacity(metrics);
  }

  optimize(metrics: readonly ResourceMetric[]): CostOptimization | null {
    return optimizeCost(metrics);
  }

  report(metricsByResource: ReadonlyMap<string, readonly ResourceMetric[]>, actor: string = 'system'): FinOpsReport {
    return generateFinOpsReport(this.tenantId, actor, metricsByResource);
  }

  audit(): readonly FinOpsAuditEntry[] {
    return getFinOpsAuditLog(this.tenantId);
  }
}
