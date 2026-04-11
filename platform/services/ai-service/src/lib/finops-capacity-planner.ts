// FinOps AI 용량 계획 엔진 -- FR-N291.1~FR-N291.6
// Design Ref: MTU-N291 DESIGN §1~§6
// Plan SC: SC-1 (비용 예측 90%+), SC-2 (예산 절감 20%+), SC-3 (사전 경고 95%+), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-10 운영보안
// N2SF: 인프라 메트릭 O등급

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 인프라 리소스 유형 */
export type ResourceType = 'compute' | 'storage' | 'network' | 'database' | 'memory' | 'license';

/** 비용 항목 */
export interface CostItem {
  readonly itemId: string;
  readonly tenantId: string;
  readonly resourceType: ResourceType;
  readonly resourceName: string;
  readonly monthlyCost: number;      // 원
  readonly usagePercent: number;     // 0~100
  readonly period: string;           // YYYY-MM
  readonly tags: Record<string, string>;
}

/** 용량 메트릭 */
export interface CapacityMetric {
  readonly metricId: string;
  readonly resourceType: ResourceType;
  readonly resourceName: string;
  readonly currentUsage: number;
  readonly maxCapacity: number;
  readonly usagePercent: number;
  readonly timestamp: string;
}

/** 비용 예측 결과 */
export interface CostForecast {
  readonly forecastId: string;
  readonly tenantId: string;
  readonly period: string;
  readonly predictedCost: number;
  readonly confidenceInterval: { lower: number; upper: number };
  readonly growthRate: number;       // %
  readonly costBreakdown: CostBreakdown[];
  readonly forecastedAt: string;
}

/** 비용 분류 */
export interface CostBreakdown {
  readonly resourceType: ResourceType;
  readonly currentCost: number;
  readonly predictedCost: number;
  readonly change: number;
  readonly changePercent: number;
}

/** 최적화 권고 */
export interface OptimizationRecommendation {
  readonly recommendationId: string;
  readonly category: 'rightsizing' | 'scheduling' | 'reservation' | 'cleanup' | 'consolidation';
  readonly title: string;
  readonly description: string;
  readonly estimatedSaving: number;  // 원/월
  readonly savingPercent: number;
  readonly effort: 'low' | 'medium' | 'high';
  readonly priority: 'high' | 'medium' | 'low';
}

/** 스케일링 정책 제안 */
export interface ScalingPolicy {
  readonly policyId: string;
  readonly resourceType: ResourceType;
  readonly resourceName: string;
  readonly scalingType: 'horizontal' | 'vertical';
  readonly trigger: string;
  readonly minCapacity: number;
  readonly maxCapacity: number;
  readonly targetUtilization: number;
  readonly cooldownSeconds: number;
}

/** FinOps 월별 리포트 */
export interface FinOpsReport {
  readonly reportId: string;
  readonly tenantId: string;
  readonly period: string;
  readonly totalCost: number;
  readonly previousPeriodCost: number;
  readonly costChange: number;
  readonly costChangePercent: number;
  readonly forecast: CostForecast;
  readonly recommendations: OptimizationRecommendation[];
  readonly scalingPolicies: ScalingPolicy[];
  readonly capacityAlerts: CapacityAlert[];
  readonly generatedAt: string;
}

/** 용량 경고 */
export interface CapacityAlert {
  readonly alertId: string;
  readonly resourceType: ResourceType;
  readonly resourceName: string;
  readonly currentUsage: number;
  readonly threshold: number;
  readonly severity: 'warning' | 'critical';
  readonly predictedExhaustion: string;  // 예상 고갈 시점
  readonly recommendation: string;
}

/** 감사 로그 */
export interface FinOpsAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: FinOpsAuditEntry[] = [];

function recordAudit(entry: Omit<FinOpsAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getFinOpsAuditLog(tenantId: string): readonly FinOpsAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 비용 데이터 저장소 ───────────────────────────────────────────────────────

const costStore: Map<string, CostItem[]> = new Map();
const metricStore: Map<string, CapacityMetric[]> = new Map();

/** 비용 데이터 수집 -- FR-N291.1 */
export function collectCostData(
  tenantId: string,
  items: Omit<CostItem, 'itemId' | 'tenantId'>[],
): CostItem[] {
  const collected = items.map(item => ({
    ...item,
    itemId: `cost-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tenantId,
  }));

  const existing = costStore.get(tenantId) ?? [];
  existing.push(...collected);
  costStore.set(tenantId, existing);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'COST_DATA_COLLECTED',
    target: tenantId,
    details: { itemCount: collected.length },
  });

  return collected;
}

/** 용량 메트릭 수집 */
export function collectCapacityMetrics(
  tenantId: string,
  metrics: Omit<CapacityMetric, 'metricId'>[],
): CapacityMetric[] {
  const collected = metrics.map(m => ({
    ...m,
    metricId: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  }));

  const existing = metricStore.get(tenantId) ?? [];
  existing.push(...collected);
  metricStore.set(tenantId, existing);

  return collected;
}

// -- 용량 예측 ────────────────────────────────────────────────────────────────

/** 용량 사용량 시계열 예측 -- FR-N291.2 */
export function forecastCapacity(
  tenantId: string,
  userId: string,
  monthsAhead: number = 3,
): CostForecast {
  const costs = costStore.get(tenantId) ?? [];

  // 월별 총비용 집계
  const monthlyCosts = new Map<string, number>();
  for (const cost of costs) {
    const existing = monthlyCosts.get(cost.period) ?? 0;
    monthlyCosts.set(cost.period, existing + cost.monthlyCost);
  }

  const sortedPeriods = Array.from(monthlyCosts.entries())
    .sort(([a], [b]) => a.localeCompare(b));

  // 성장률 계산
  let growthRate = 5; // 기본 5%
  if (sortedPeriods.length >= 2) {
    const lastEntry = sortedPeriods[sortedPeriods.length - 1];
    const prevEntry = sortedPeriods[sortedPeriods.length - 2];
    if (lastEntry && prevEntry) {
      const lastCost = lastEntry[1];
      const prevCost = prevEntry[1];
      growthRate = prevCost > 0 ? ((lastCost - prevCost) / prevCost) * 100 : 5;
    }
  }

  const lastPeriod = sortedPeriods[sortedPeriods.length - 1];
  const currentCost = lastPeriod ? lastPeriod[1] : 1000000;

  const predictedCost = Math.round(currentCost * (1 + growthRate * monthsAhead / 100));

  // 리소스 유형별 분류
  const typeBreakdown = new Map<ResourceType, { current: number; count: number }>();
  for (const cost of costs) {
    const existing = typeBreakdown.get(cost.resourceType) ?? { current: 0, count: 0 };
    existing.current += cost.monthlyCost;
    existing.count++;
    typeBreakdown.set(cost.resourceType, existing);
  }

  const costBreakdown: CostBreakdown[] = Array.from(typeBreakdown.entries()).map(
    ([type, data]) => {
      const predicted = Math.round(data.current * (1 + growthRate / 100));
      return {
        resourceType: type,
        currentCost: data.current,
        predictedCost: predicted,
        change: predicted - data.current,
        changePercent: data.current > 0 ? Math.round(((predicted - data.current) / data.current) * 100) : 0,
      };
    },
  );

  const forecast: CostForecast = {
    forecastId: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    period: `${monthsAhead}개월 예측`,
    predictedCost,
    confidenceInterval: {
      lower: Math.round(predictedCost * 0.85),
      upper: Math.round(predictedCost * 1.15),
    },
    growthRate: Math.round(growthRate * 100) / 100,
    costBreakdown,
    forecastedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: userId,
    tenantId,
    action: 'CAPACITY_FORECASTED',
    target: forecast.forecastId,
    details: { predictedCost, growthRate: forecast.growthRate, monthsAhead },
  });

  return forecast;
}

// -- 최적화 권고 ──────────────────────────────────────────────────────────────

/** 비용 최적화 권고 생성 -- FR-N291.3 */
export function generateOptimizations(
  tenantId: string,
  userId: string,
): OptimizationRecommendation[] {
  const costs = costStore.get(tenantId) ?? [];
  const metrics = metricStore.get(tenantId) ?? [];
  const recommendations: OptimizationRecommendation[] = [];

  // 1. 저사용 리소스 라이트사이징
  const lowUsage = metrics.filter(m => m.usagePercent < 30);
  if (lowUsage.length > 0) {
    const totalCost = costs
      .filter(c => lowUsage.some(l => l.resourceName === c.resourceName))
      .reduce((s, c) => s + c.monthlyCost, 0);
    recommendations.push({
      recommendationId: `rec-${Date.now()}-1`,
      category: 'rightsizing',
      title: '저사용 리소스 라이트사이징',
      description: `사용률 30% 미만 리소스 ${lowUsage.length}개를 축소하십시오`,
      estimatedSaving: Math.round(totalCost * 0.4),
      savingPercent: 40,
      effort: 'medium',
      priority: 'high',
    });
  }

  // 2. 비업무 시간 스케줄링
  recommendations.push({
    recommendationId: `rec-${Date.now()}-2`,
    category: 'scheduling',
    title: '비업무 시간 리소스 축소',
    description: '야간/주말 비필수 리소스 자동 축소 스케줄 적용',
    estimatedSaving: Math.round(costs.reduce((s, c) => s + c.monthlyCost, 0) * 0.15),
    savingPercent: 15,
    effort: 'low',
    priority: 'medium',
  });

  // 3. 미사용 리소스 정리
  const unusedResources = metrics.filter(m => m.usagePercent === 0);
  if (unusedResources.length > 0) {
    recommendations.push({
      recommendationId: `rec-${Date.now()}-3`,
      category: 'cleanup',
      title: '미사용 리소스 제거',
      description: `사용률 0% 리소스 ${unusedResources.length}개를 제거하십시오`,
      estimatedSaving: Math.round(costs.filter(c => unusedResources.some(u => u.resourceName === c.resourceName)).reduce((s, c) => s + c.monthlyCost, 0)),
      savingPercent: 100,
      effort: 'low',
      priority: 'high',
    });
  }

  recordAudit({
    actor: userId,
    tenantId,
    action: 'OPTIMIZATIONS_GENERATED',
    target: tenantId,
    details: { recommendationCount: recommendations.length, totalSaving: recommendations.reduce((s, r) => s + r.estimatedSaving, 0) },
  });

  return recommendations;
}

// -- 스케일링 정책 제안 ───────────────────────────────────────────────────────

/** 자동 스케일링 정책 제안 -- FR-N291.4 */
export function suggestScalingPolicies(
  tenantId: string,
): ScalingPolicy[] {
  const metrics = metricStore.get(tenantId) ?? [];
  const policies: ScalingPolicy[] = [];

  // 고사용 리소스에 대한 스케일링 정책
  const highUsage = metrics.filter(m => m.usagePercent > 70);
  for (const metric of highUsage) {
    policies.push({
      policyId: `scale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      resourceType: metric.resourceType,
      resourceName: metric.resourceName,
      scalingType: metric.resourceType === 'compute' ? 'horizontal' : 'vertical',
      trigger: `사용률 ${Math.round(metric.usagePercent)}% (임계값 70% 초과)`,
      minCapacity: Math.round(metric.maxCapacity * 0.3),
      maxCapacity: Math.round(metric.maxCapacity * 2),
      targetUtilization: 60,
      cooldownSeconds: 300,
    });
  }

  return policies;
}

// -- 용량 경고 ────────────────────────────────────────────────────────────────

/** 용량 부족 사전 경고 */
export function checkCapacityAlerts(
  tenantId: string,
): CapacityAlert[] {
  const metrics = metricStore.get(tenantId) ?? [];
  const alerts: CapacityAlert[] = [];

  for (const metric of metrics) {
    if (metric.usagePercent > 90) {
      alerts.push({
        alertId: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        resourceType: metric.resourceType,
        resourceName: metric.resourceName,
        currentUsage: metric.usagePercent,
        threshold: 90,
        severity: 'critical',
        predictedExhaustion: '7일 이내',
        recommendation: `${metric.resourceName} 용량 즉시 증설 필요`,
      });
    } else if (metric.usagePercent > 75) {
      alerts.push({
        alertId: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        resourceType: metric.resourceType,
        resourceName: metric.resourceName,
        currentUsage: metric.usagePercent,
        threshold: 75,
        severity: 'warning',
        predictedExhaustion: '30일 이내',
        recommendation: `${metric.resourceName} 용량 증설 계획 수립 필요`,
      });
    }
  }

  return alerts;
}

// -- FinOps 리포트 ────────────────────────────────────────────────────────────

/** FinOps 월별 리포트 생성 -- FR-N291.5 */
export function generateFinOpsReport(
  tenantId: string,
  userId: string,
): FinOpsReport {
  const forecast = forecastCapacity(tenantId, userId);
  const recommendations = generateOptimizations(tenantId, userId);
  const scalingPolicies = suggestScalingPolicies(tenantId);
  const capacityAlerts = checkCapacityAlerts(tenantId);

  const costs = costStore.get(tenantId) ?? [];
  const totalCost = costs.reduce((s, c) => s + c.monthlyCost, 0);
  const previousPeriodCost = Math.round(totalCost * 0.95); // 시뮬레이션

  const report: FinOpsReport = {
    reportId: `finops-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    period: new Date().toISOString().slice(0, 7),
    totalCost,
    previousPeriodCost,
    costChange: totalCost - previousPeriodCost,
    costChangePercent: previousPeriodCost > 0 ? Math.round(((totalCost - previousPeriodCost) / previousPeriodCost) * 100) : 0,
    forecast,
    recommendations,
    scalingPolicies,
    capacityAlerts,
    generatedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: userId,
    tenantId,
    action: 'FINOPS_REPORT_GENERATED',
    target: report.reportId,
    details: { totalCost, recommendations: recommendations.length, alerts: capacityAlerts.length },
  });

  return report;
}

/** FinOps AI 서비스 */
export class FinOpsCapacityPlannerService {
  constructor(private readonly tenantId: string) {}

  collectCosts(items: Omit<CostItem, 'itemId' | 'tenantId'>[]): CostItem[] {
    return collectCostData(this.tenantId, items);
  }

  collectMetrics(metrics: Omit<CapacityMetric, 'metricId'>[]): CapacityMetric[] {
    return collectCapacityMetrics(this.tenantId, metrics);
  }

  forecast(userId: string, months?: number): CostForecast {
    return forecastCapacity(this.tenantId, userId, months);
  }

  optimize(userId: string): OptimizationRecommendation[] {
    return generateOptimizations(this.tenantId, userId);
  }

  generateReport(userId: string): FinOpsReport {
    return generateFinOpsReport(this.tenantId, userId);
  }

  getAuditLog(): readonly FinOpsAuditEntry[] {
    return getFinOpsAuditLog(this.tenantId);
  }
}
