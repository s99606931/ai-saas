// SaaS 구독 AI 최적화 -- FR-N268.1~FR-N268.6
// Design Ref: MTU-N268 DESIGN §1~§6
// CSAP: D-06 감사, D-07 모니터링, D-12 개발 보안
// N2SF: 집계 사용량 데이터만 분석 (O등급)

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 사용 패턴 유형 -- Design §2 */
export type UsagePattern = 'growing' | 'stable' | 'declining' | 'burst' | 'seasonal';

/** 플랜 티어 */
export type PlanTier = 'starter' | 'professional' | 'enterprise' | 'custom';

/** 사용량 데이터 포인트 -- Design §1 */
export interface UsageDataPoint {
  timestamp: string;
  tenantId: string;
  metricName: string;
  value: number;
}

/** 구독 플랜 정보 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: PlanTier;
  monthlyPrice: number;
  includedUsage: Record<string, number>;
  overageRate: Record<string, number>;
}

/** 사용량 분석 결과 -- Design §1~§2 */
export interface UsageAnalysis {
  tenantId: string;
  period: { start: string; end: string };
  pattern: UsagePattern;
  metrics: UsageMetricSummary[];
  trendSlope: number;
  volatility: number;
  seasonalityDetected: boolean;
}

/** 메트릭 요약 */
export interface UsageMetricSummary {
  metricName: string;
  average: number;
  peak: number;
  p95: number;
  total: number;
  dataPoints: number;
}

/** 플랜 추천 -- Design §3 */
export interface PlanRecommendation {
  id: string;
  tenantId: string;
  currentPlan: SubscriptionPlan;
  recommendedPlan: SubscriptionPlan;
  action: 'upgrade' | 'downgrade' | 'maintain';
  estimatedMonthlySaving: number;
  estimatedAnnualSaving: number;
  confidence: number;
  reason: string;
  createdAt: string;
}

/** 이상 과금 알림 -- Design §4 */
export interface BillingAnomaly {
  id: string;
  tenantId: string;
  metricName: string;
  expectedValue: number;
  actualValue: number;
  zScore: number;
  severity: 'warning' | 'critical';
  detectedAt: string;
}

/** 비용 시뮬레이션 결과 -- Design §5 */
export interface CostSimulation {
  id: string;
  tenantId: string;
  scenarios: CostScenario[];
  createdAt: string;
}

/** 비용 시나리오 */
export interface CostScenario {
  plan: SubscriptionPlan;
  estimatedMonthlyCost: number;
  includedUsagePct: number;
  overageCost: number;
}

/** 감사 항목 */
export interface SubscriptionAuditEntry {
  id: string;
  action: string;
  actor: string;
  tenantId?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: SubscriptionAuditEntry[] = [];

function recordAudit(
  action: string,
  actor: string,
  details: Record<string, unknown>
): void {
  auditLog.push({
    id: randomUUID(),
    action,
    actor,
    tenantId: details.tenantId as string | undefined,
    details,
    timestamp: new Date().toISOString(),
  });
}

export function getSubscriptionAuditLog(): SubscriptionAuditEntry[] {
  return [...auditLog];
}

// -- §1 사용량 시계열 분석 ────────────────────────────────────────────────────

/** 추세 기울기 계산 (선형 회귀) */
function calculateTrendSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i] ?? 0;
    sumXY += i * (values[i] ?? 0);
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;
  return (n * sumXY - sumX * sumY) / denominator;
}

/** 변동성 (변동계수) 계산 */
function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/** 사용량 분석 -- FR-N268.1 */
export function analyzeUsage(
  dataPoints: UsageDataPoint[],
  tenantId: string,
  actor: string
): UsageAnalysis {
  // 메트릭별 그룹핑
  const metricGroups = new Map<string, number[]>();
  for (const dp of dataPoints) {
    if (dp.tenantId !== tenantId) continue;
    const existing = metricGroups.get(dp.metricName) || [];
    existing.push(dp.value);
    metricGroups.set(dp.metricName, existing);
  }

  const metrics: UsageMetricSummary[] = [];
  const allValues: number[] = [];

  for (const [metricName, values] of metricGroups) {
    const sorted = [...values].sort((a, b) => a - b);
    const total = values.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(sorted.length * 0.95);

    metrics.push({
      metricName,
      average: total / values.length,
      peak: sorted[sorted.length - 1] || 0,
      p95: sorted[p95Index] || 0,
      total,
      dataPoints: values.length,
    });

    allValues.push(...values);
  }

  const trendSlope = calculateTrendSlope(allValues);
  const volatility = calculateVolatility(allValues);
  const pattern = classifyPattern(trendSlope, volatility);

  const timestamps = dataPoints.filter((dp) => dp.tenantId === tenantId).map((dp) => dp.timestamp);

  recordAudit('USAGE_ANALYZED', actor, { tenantId, pattern, dataPoints: allValues.length });

  return {
    tenantId,
    period: {
      start: timestamps[0] || new Date().toISOString(),
      end: timestamps[timestamps.length - 1] || new Date().toISOString(),
    },
    pattern,
    metrics,
    trendSlope,
    volatility,
    seasonalityDetected: volatility > 0.3,
  };
}

// -- §2 패턴 분류 ────────────────────────────────────────────────────────────

/** 사용 패턴 분류 -- FR-N268.2 */
export function classifyPattern(trendSlope: number, volatility: number): UsagePattern {
  if (volatility > 0.5) return 'burst';
  if (volatility > 0.3) return 'seasonal';
  if (trendSlope > 0.05) return 'growing';
  if (trendSlope < -0.05) return 'declining';
  return 'stable';
}

// -- §3 플랜 추천 ────────────────────────────────────────────────────────────

/** 최적 플랜 추천 -- FR-N268.3 */
export function recommendPlan(
  analysis: UsageAnalysis,
  currentPlan: SubscriptionPlan,
  availablePlans: SubscriptionPlan[],
  actor: string
): PlanRecommendation {
  let bestPlan = currentPlan;
  let bestCost = Infinity;

  for (const plan of availablePlans) {
    const cost = estimateMonthlyCost(analysis, plan);
    if (cost < bestCost) {
      bestCost = cost;
      bestPlan = plan;
    }
  }

  const currentCost = estimateMonthlyCost(analysis, currentPlan);
  const saving = currentCost - bestCost;

  let action: PlanRecommendation['action'] = 'maintain';
  if (bestPlan.tier !== currentPlan.tier) {
    const tierOrder: PlanTier[] = ['starter', 'professional', 'enterprise', 'custom'];
    action = tierOrder.indexOf(bestPlan.tier) > tierOrder.indexOf(currentPlan.tier)
      ? 'upgrade'
      : 'downgrade';
  }

  const recommendation: PlanRecommendation = {
    id: randomUUID(),
    tenantId: analysis.tenantId,
    currentPlan,
    recommendedPlan: bestPlan,
    action,
    estimatedMonthlySaving: Math.max(0, saving),
    estimatedAnnualSaving: Math.max(0, saving * 12),
    confidence: analysis.pattern === 'stable' ? 0.9 : 0.7,
    reason: generateRecommendationReason(analysis, currentPlan, bestPlan, saving),
    createdAt: new Date().toISOString(),
  };

  recordAudit('PLAN_RECOMMENDED', actor, {
    tenantId: analysis.tenantId,
    action,
    saving,
  });

  return recommendation;
}

/** 월간 비용 추정 */
function estimateMonthlyCost(analysis: UsageAnalysis, plan: SubscriptionPlan): number {
  let totalCost = plan.monthlyPrice;

  for (const metric of analysis.metrics) {
    const included = plan.includedUsage[metric.metricName] || 0;
    const overage = Math.max(0, metric.average - included);
    const rate = plan.overageRate[metric.metricName] || 0;
    totalCost += overage * rate;
  }

  return totalCost;
}

/** 추천 사유 생성 */
function generateRecommendationReason(
  analysis: UsageAnalysis,
  current: SubscriptionPlan,
  recommended: SubscriptionPlan,
  saving: number
): string {
  if (current.id === recommended.id) {
    return `현재 ${current.name} 플랜이 사용 패턴(${analysis.pattern})에 최적입니다.`;
  }
  if (saving > 0) {
    return `${recommended.name} 플랜으로 변경 시 월 ${saving.toLocaleString()}원 절감 예상. ` +
      `사용 패턴: ${analysis.pattern}.`;
  }
  return `${recommended.name} 플랜이 현재 사용량에 더 적합합니다. 패턴: ${analysis.pattern}.`;
}

// -- §4 이상 과금 감지 ────────────────────────────────────────────────────────

/** 이상 과금 감지 -- FR-N268.4 */
export function detectBillingAnomalies(
  dataPoints: UsageDataPoint[],
  tenantId: string,
  actor: string
): BillingAnomaly[] {
  const metricGroups = new Map<string, number[]>();
  for (const dp of dataPoints) {
    if (dp.tenantId !== tenantId) continue;
    const existing = metricGroups.get(dp.metricName) || [];
    existing.push(dp.value);
    metricGroups.set(dp.metricName, existing);
  }

  const anomalies: BillingAnomaly[] = [];

  for (const [metricName, values] of metricGroups) {
    if (values.length < 3) continue;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stddev = Math.sqrt(
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    );

    // 최신 값 (마지막) 검사
    const latest = values[values.length - 1] ?? 0;
    const zScore = stddev > 0 ? (latest - mean) / stddev : 0;

    if (Math.abs(zScore) > 2) {
      anomalies.push({
        id: randomUUID(),
        tenantId,
        metricName,
        expectedValue: mean,
        actualValue: latest,
        zScore,
        severity: Math.abs(zScore) > 3 ? 'critical' : 'warning',
        detectedAt: new Date().toISOString(),
      });
    }
  }

  if (anomalies.length > 0) {
    recordAudit('BILLING_ANOMALY_DETECTED', actor, {
      tenantId,
      anomalyCount: anomalies.length,
    });
  }

  return anomalies;
}

// -- §5 비용 시뮬레이션 ──────────────────────────────────────────────────────

/** 비용 시뮬레이션 -- FR-N268.5 */
export function simulateCosts(
  analysis: UsageAnalysis,
  plans: SubscriptionPlan[],
  actor: string
): CostSimulation {
  const scenarios: CostScenario[] = plans.map((plan) => {
    const estimatedCost = estimateMonthlyCost(analysis, plan);
    const totalIncluded = Object.values(plan.includedUsage).reduce((a, b) => a + b, 0);
    const totalUsage = analysis.metrics.reduce((sum, m) => sum + m.average, 0);
    const includedPct = totalIncluded > 0 ? Math.min(1, totalUsage / totalIncluded) : 0;

    return {
      plan,
      estimatedMonthlyCost: estimatedCost,
      includedUsagePct: includedPct * 100,
      overageCost: Math.max(0, estimatedCost - plan.monthlyPrice),
    };
  });

  const simulation: CostSimulation = {
    id: randomUUID(),
    tenantId: analysis.tenantId,
    scenarios,
    createdAt: new Date().toISOString(),
  };

  recordAudit('COST_SIMULATED', actor, { tenantId: analysis.tenantId, scenarioCount: scenarios.length });
  return simulation;
}
