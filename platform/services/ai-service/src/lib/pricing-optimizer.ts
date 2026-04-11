// AI 가격 최적화 엔진 -- FR-N269.1~FR-N269.6
// Design Ref: MTU-N269 DESIGN §1~§6
// CSAP: D-06 감사, D-12 개발 보안
// N2SF: 집계 매출 데이터만 사용 (O등급)

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 가격 데이터 포인트 -- Design §1 */
export interface PriceDataPoint {
  price: number;
  demand: number;
  revenue: number;
  period: string;
  segment?: string;
}

/** 수요 탄력성 결과 -- Design §1 */
export interface ElasticityResult {
  coefficient: number;
  interpretation: 'elastic' | 'inelastic' | 'unit_elastic';
  priceRange: { min: number; max: number };
  confidenceInterval: { lower: number; upper: number };
}

/** 가격 시뮬레이션 요청 -- Design §2 */
export interface PriceSimulationRequest {
  currentPrice: number;
  proposedPrice: number;
  elasticity: ElasticityResult;
  currentDemand: number;
}

/** 시뮬레이션 결과 -- Design §2 */
export interface PriceSimulationResult {
  id: string;
  currentPrice: number;
  proposedPrice: number;
  priceChangePct: number;
  estimatedDemandChange: number;
  estimatedNewDemand: number;
  estimatedRevenue: number;
  estimatedRevenueChange: number;
  recommendation: 'proceed' | 'caution' | 'avoid';
}

/** 최적 가격 결과 -- Design §3 */
export interface OptimalPriceResult {
  id: string;
  optimalPrice: number;
  estimatedMaxRevenue: number;
  currentPrice: number;
  currentRevenue: number;
  improvementPct: number;
  constraints: PriceConstraints;
  createdAt: string;
}

/** 가격 제약 조건 */
export interface PriceConstraints {
  minPrice: number;
  maxPrice: number;
  regulatoryLimit?: number;
  competitorAverage?: number;
}

/** 경쟁 벤치마킹 -- Design §4 */
export interface CompetitorBenchmark {
  competitorName: string;
  price: number;
  features: string[];
  marketShare?: number;
}

/** 경쟁 분석 결과 */
export interface CompetitiveAnalysis {
  id: string;
  ourPrice: number;
  marketAverage: number;
  positioningScore: number;
  priceIndex: number;
  competitors: CompetitorBenchmark[];
  recommendation: string;
  analyzedAt: string;
}

/** 수익 예측 -- Design §5 */
export interface RevenueProjection {
  id: string;
  months: MonthlyProjection[];
  totalProjectedRevenue: number;
  totalCurrentRevenue: number;
  netChange: number;
  createdAt: string;
}

/** 월별 예측 */
export interface MonthlyProjection {
  month: string;
  projectedRevenue: number;
  currentRevenue: number;
  difference: number;
}

/** 감사 항목 */
export interface PricingAuditEntry {
  id: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: PricingAuditEntry[] = [];

function recordAudit(action: string, actor: string, details: Record<string, unknown>): void {
  auditLog.push({
    id: randomUUID(),
    action,
    actor,
    details,
    timestamp: new Date().toISOString(),
  });
}

export function getPricingAuditLog(): PricingAuditEntry[] {
  return [...auditLog];
}

// -- §1 수요 탄력성 모델링 ────────────────────────────────────────────────────

/** 수요 탄력성 계산 -- FR-N269.1 */
export function calculateElasticity(
  dataPoints: PriceDataPoint[],
  actor: string
): ElasticityResult {
  if (dataPoints.length < 2) {
    throw new Error('탄력성 계산에 최소 2개 이상의 데이터 포인트가 필요합니다');
  }

  // 점 탄력성 계산 (연속 데이터 포인트 간)
  const elasticities: number[] = [];
  for (let i = 1; i < dataPoints.length; i++) {
    const dp0 = dataPoints[i - 1]!;
    const dp1 = dataPoints[i]!;

    if (dp0.price === dp1.price) continue;

    const pctDemandChange = (dp1.demand - dp0.demand) / dp0.demand;
    const pctPriceChange = (dp1.price - dp0.price) / dp0.price;

    if (pctPriceChange !== 0) {
      elasticities.push(pctDemandChange / pctPriceChange);
    }
  }

  const avgElasticity = elasticities.length > 0
    ? elasticities.reduce((a, b) => a + b, 0) / elasticities.length
    : 0;

  const prices = dataPoints.map((dp) => dp.price);
  const stddev = elasticities.length > 1
    ? Math.sqrt(elasticities.reduce((sum, e) => sum + (e - avgElasticity) ** 2, 0) / elasticities.length)
    : 0;

  let interpretation: ElasticityResult['interpretation'];
  if (Math.abs(avgElasticity) > 1) interpretation = 'elastic';
  else if (Math.abs(avgElasticity) < 1) interpretation = 'inelastic';
  else interpretation = 'unit_elastic';

  recordAudit('ELASTICITY_CALCULATED', actor, {
    coefficient: avgElasticity,
    interpretation,
    dataPoints: dataPoints.length,
  });

  return {
    coefficient: avgElasticity,
    interpretation,
    priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
    confidenceInterval: {
      lower: avgElasticity - 1.96 * stddev,
      upper: avgElasticity + 1.96 * stddev,
    },
  };
}

// -- §2 가격 시뮬레이션 ──────────────────────────────────────────────────────

/** 가격 변경 시뮬레이션 -- FR-N269.2 */
export function simulatePriceChange(
  request: PriceSimulationRequest,
  actor: string
): PriceSimulationResult {
  const priceChangePct = (request.proposedPrice - request.currentPrice) / request.currentPrice;
  const demandChangePct = priceChangePct * request.elasticity.coefficient;
  const newDemand = request.currentDemand * (1 + demandChangePct);
  const newRevenue = request.proposedPrice * newDemand;
  const currentRevenue = request.currentPrice * request.currentDemand;
  const revenueChange = newRevenue - currentRevenue;

  let recommendation: PriceSimulationResult['recommendation'];
  if (revenueChange > 0) recommendation = 'proceed';
  else if (revenueChange > -currentRevenue * 0.05) recommendation = 'caution';
  else recommendation = 'avoid';

  const result: PriceSimulationResult = {
    id: randomUUID(),
    currentPrice: request.currentPrice,
    proposedPrice: request.proposedPrice,
    priceChangePct: priceChangePct * 100,
    estimatedDemandChange: demandChangePct * 100,
    estimatedNewDemand: Math.max(0, newDemand),
    estimatedRevenue: Math.max(0, newRevenue),
    estimatedRevenueChange: revenueChange,
    recommendation,
  };

  recordAudit('PRICE_SIMULATED', actor, {
    currentPrice: request.currentPrice,
    proposedPrice: request.proposedPrice,
    recommendation,
  });

  return result;
}

// -- §3 최적 가격 추천 ────────────────────────────────────────────────────────

/** 수익 극대화 최적 가격 탐색 -- FR-N269.3 */
export function findOptimalPrice(
  elasticity: ElasticityResult,
  currentPrice: number,
  currentDemand: number,
  constraints: PriceConstraints,
  actor: string
): OptimalPriceResult {
  const step = (constraints.maxPrice - constraints.minPrice) / 100;
  let bestPrice = currentPrice;
  let bestRevenue = currentPrice * currentDemand;

  for (let price = constraints.minPrice; price <= constraints.maxPrice; price += step) {
    const pctChange = (price - currentPrice) / currentPrice;
    const demandChange = pctChange * elasticity.coefficient;
    const demand = Math.max(0, currentDemand * (1 + demandChange));
    const revenue = price * demand;

    if (revenue > bestRevenue) {
      bestRevenue = revenue;
      bestPrice = price;
    }
  }

  // 규제 한도 적용
  if (constraints.regulatoryLimit && bestPrice > constraints.regulatoryLimit) {
    bestPrice = constraints.regulatoryLimit;
  }

  const currentRevenue = currentPrice * currentDemand;
  const improvement = currentRevenue > 0
    ? ((bestRevenue - currentRevenue) / currentRevenue) * 100
    : 0;

  const result: OptimalPriceResult = {
    id: randomUUID(),
    optimalPrice: Math.round(bestPrice * 100) / 100,
    estimatedMaxRevenue: Math.round(bestRevenue),
    currentPrice,
    currentRevenue: Math.round(currentRevenue),
    improvementPct: Math.round(improvement * 100) / 100,
    constraints,
    createdAt: new Date().toISOString(),
  };

  recordAudit('OPTIMAL_PRICE_FOUND', actor, {
    optimalPrice: bestPrice,
    improvement,
  });

  return result;
}

// -- §4 경쟁 벤치마킹 ────────────────────────────────────────────────────────

/** 경쟁사 가격 비교 분석 -- FR-N269.4 */
export function analyzeCompetition(
  ourPrice: number,
  competitors: CompetitorBenchmark[],
  actor: string
): CompetitiveAnalysis {
  const competitorPrices = competitors.map((c) => c.price);
  const marketAverage = competitorPrices.length > 0
    ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length
    : ourPrice;

  const priceIndex = marketAverage > 0 ? (ourPrice / marketAverage) * 100 : 100;

  // 포지셔닝 점수: 100 기준, 높을수록 프리미엄
  const positioningScore = priceIndex;

  let recommendation: string;
  if (priceIndex > 120) {
    recommendation = '프리미엄 포지셔닝. 차별화 가치 검증 필요. 가격 정당성 소통 강화 권장.';
  } else if (priceIndex > 90) {
    recommendation = '시장 평균 범위. 현재 포지셔닝 적절. 서비스 차별화로 가치 제고 권장.';
  } else {
    recommendation = '저가 포지셔닝. 시장 점유율 확대 전략. 수익성 모니터링 필요.';
  }

  const analysis: CompetitiveAnalysis = {
    id: randomUUID(),
    ourPrice,
    marketAverage: Math.round(marketAverage),
    positioningScore: Math.round(positioningScore),
    priceIndex: Math.round(priceIndex),
    competitors,
    recommendation,
    analyzedAt: new Date().toISOString(),
  };

  recordAudit('COMPETITION_ANALYZED', actor, { priceIndex, positioningScore });
  return analysis;
}

// -- §5 수익 영향 예측 ────────────────────────────────────────────────────────

/** 가격 변경 수익 영향 예측 -- FR-N269.5 */
export function projectRevenue(
  elasticity: ElasticityResult,
  currentPrice: number,
  proposedPrice: number,
  currentMonthlyDemand: number,
  monthsAhead: number,
  growthRate: number,
  actor: string
): RevenueProjection {
  const pctChange = (proposedPrice - currentPrice) / currentPrice;
  const demandChangePct = pctChange * elasticity.coefficient;

  const months: MonthlyProjection[] = [];
  let totalProjected = 0;
  let totalCurrent = 0;

  for (let m = 1; m <= monthsAhead; m++) {
    const growthFactor = Math.pow(1 + growthRate, m);
    const currentDemand = currentMonthlyDemand * growthFactor;
    const projectedDemand = Math.max(0, currentDemand * (1 + demandChangePct));

    const currentRev = currentPrice * currentDemand;
    const projectedRev = proposedPrice * projectedDemand;

    const monthLabel = new Date();
    monthLabel.setMonth(monthLabel.getMonth() + m);

    months.push({
      month: monthLabel.toISOString().substring(0, 7),
      projectedRevenue: Math.round(projectedRev),
      currentRevenue: Math.round(currentRev),
      difference: Math.round(projectedRev - currentRev),
    });

    totalProjected += projectedRev;
    totalCurrent += currentRev;
  }

  const projection: RevenueProjection = {
    id: randomUUID(),
    months,
    totalProjectedRevenue: Math.round(totalProjected),
    totalCurrentRevenue: Math.round(totalCurrent),
    netChange: Math.round(totalProjected - totalCurrent),
    createdAt: new Date().toISOString(),
  };

  recordAudit('REVENUE_PROJECTED', actor, {
    currentPrice,
    proposedPrice,
    monthsAhead,
    netChange: projection.netChange,
  });

  return projection;
}
