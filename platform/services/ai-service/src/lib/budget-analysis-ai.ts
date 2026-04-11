// 예산서 AI 분석/이상 탐지 -- FR-N297.1~FR-N297.6
// Design Ref: MTU-N297 DESIGN §1~§6
// Plan SC: SC-1 (탐지율 85%+), SC-2 (오탐 15% 이하), SC-3 (리포트 10초), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근통제, D-12 개발보안

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 예산 항목 */
export interface BudgetItem {
  readonly itemId: string;
  readonly category: string;
  readonly subCategory: string;
  readonly description: string;
  readonly currentAmount: number;
  readonly previousAmount: number;
  readonly executedAmount: number;
  readonly fiscalYear: number;
}

/** 예산 이상 탐지 결과 */
export interface BudgetAnomaly {
  readonly anomalyId: string;
  readonly itemId: string;
  readonly category: string;
  readonly anomalyType: 'spike' | 'drop' | 'zero_execution' | 'over_execution' | 'unusual_pattern';
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly changeRate: number;
  readonly description: string;
  readonly recommendation: string;
}

/** 집행률 예측 */
export interface ExecutionForecast {
  readonly itemId: string;
  readonly category: string;
  readonly currentRate: number;
  readonly predictedRate: number;
  readonly targetRate: number;
  readonly riskLevel: 'high' | 'medium' | 'low';
  readonly warning: string;
}

/** 벤치마크 비교 결과 */
export interface BenchmarkComparison {
  readonly category: string;
  readonly orgAmount: number;
  readonly avgAmount: number;
  readonly deviation: number;
  readonly percentile: number;
  readonly assessment: string;
}

/** 예산 분석 리포트 */
export interface BudgetAnalysisReport {
  readonly reportId: string;
  readonly tenantId: string;
  readonly fiscalYear: number;
  readonly totalBudget: number;
  readonly totalExecuted: number;
  readonly executionRate: number;
  readonly anomalies: BudgetAnomaly[];
  readonly forecasts: ExecutionForecast[];
  readonly benchmarks: BenchmarkComparison[];
  readonly generatedAt: string;
}

/** 감사 로그 */
export interface BudgetAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: BudgetAuditEntry[] = [];

function recordAudit(entry: Omit<BudgetAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getBudgetAuditLog(tenantId: string): readonly BudgetAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 예산 데이터 파싱 ────────────────────────────────────────────────────────

const BUDGET_CATEGORIES: Record<string, string[]> = {
  '인건비': ['급여', '수당', '복리후생비', '퇴직급여'],
  '사업비': ['용역비', '시설비', '장비구입비', '재료비'],
  '경상비': ['여비', '공공요금', '수용비', '임차료'],
  '이전지출': ['보조금', '출연금', '교부금', '부담금'],
  '예비비': ['일반예비비', '특별예비비'],
};

/** 예산 항목 분류 -- FR-N297.1 */
export function classifyBudgetItem(item: BudgetItem): string {
  for (const [mainCategory, subCategories] of Object.entries(BUDGET_CATEGORIES)) {
    if (subCategories.some(sub => item.subCategory.includes(sub) || item.description.includes(sub))) {
      return mainCategory;
    }
  }
  return item.category || '기타';
}

// -- 이상 탐지 ────────────────────────────────────────────────────────────────

const ANOMALY_THRESHOLDS = {
  spikeRate: 0.5,       // 50% 이상 증가
  dropRate: -0.3,       // 30% 이상 감소
  overExecutionRate: 1.1, // 110% 이상 집행
  zeroExecutionThreshold: 0.05, // 5% 미만 집행
};

/** 전년 대비 이상 증감 탐지 -- FR-N297.2 */
export function detectBudgetAnomalies(
  tenantId: string,
  items: BudgetItem[],
): BudgetAnomaly[] {
  const anomalies: BudgetAnomaly[] = [];

  for (const item of items) {
    const prevAmount = item.previousAmount;
    const currAmount = item.currentAmount;
    const changeRate = prevAmount > 0 ? (currAmount - prevAmount) / prevAmount : 0;
    const executionRate = currAmount > 0 ? item.executedAmount / currAmount : 0;

    // 급증 탐지
    if (changeRate > ANOMALY_THRESHOLDS.spikeRate) {
      anomalies.push({
        anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: item.itemId,
        category: classifyBudgetItem(item),
        anomalyType: 'spike',
        severity: changeRate > 1.0 ? 'critical' : 'high',
        changeRate,
        description: `${item.description}: 전년 대비 ${(changeRate * 100).toFixed(1)}% 급증`,
        recommendation: '증액 사유 확인 및 집행 계획 검토 필요',
      });
    }

    // 급감 탐지
    if (changeRate < ANOMALY_THRESHOLDS.dropRate) {
      anomalies.push({
        anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: item.itemId,
        category: classifyBudgetItem(item),
        anomalyType: 'drop',
        severity: changeRate < -0.5 ? 'high' : 'medium',
        changeRate,
        description: `${item.description}: 전년 대비 ${(Math.abs(changeRate) * 100).toFixed(1)}% 감소`,
        recommendation: '사업 축소 또는 이관 여부 확인',
      });
    }

    // 초과 집행
    if (executionRate > ANOMALY_THRESHOLDS.overExecutionRate) {
      anomalies.push({
        anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: item.itemId,
        category: classifyBudgetItem(item),
        anomalyType: 'over_execution',
        severity: 'critical',
        changeRate: executionRate,
        description: `${item.description}: 집행률 ${(executionRate * 100).toFixed(1)}% (초과)`,
        recommendation: '추경 편성 또는 타 항목 전용 검토',
      });
    }

    // 무집행 / 극저 집행
    if (currAmount > 0 && executionRate < ANOMALY_THRESHOLDS.zeroExecutionThreshold) {
      anomalies.push({
        anomalyId: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: item.itemId,
        category: classifyBudgetItem(item),
        anomalyType: 'zero_execution',
        severity: 'medium',
        changeRate: executionRate,
        description: `${item.description}: 집행률 ${(executionRate * 100).toFixed(1)}% (극저)`,
        recommendation: '사업 추진 지연 사유 확인, 불용 가능성 검토',
      });
    }
  }

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'BUDGET_ANOMALY_DETECTED',
    target: tenantId,
    details: { itemsAnalyzed: items.length, anomaliesFound: anomalies.length },
  });

  return anomalies;
}

// -- 집행률 예측 ──────────────────────────────────────────────────────────────

/** 집행률 예측 -- FR-N297.3 */
export function forecastExecution(
  tenantId: string,
  items: BudgetItem[],
  currentMonth: number,
): ExecutionForecast[] {
  const forecasts: ExecutionForecast[] = [];
  const monthRatio = currentMonth / 12;
  const targetRate = monthRatio; // 균등 집행 기준

  for (const item of items) {
    if (item.currentAmount === 0) continue;

    const currentRate = item.executedAmount / item.currentAmount;
    const predictedRate = monthRatio > 0 ? currentRate / monthRatio : 0;

    let riskLevel: ExecutionForecast['riskLevel'] = 'low';
    let warning = '정상 집행 범위';

    if (predictedRate > 1.2) {
      riskLevel = 'high';
      warning = '초과 집행 위험: 연말 예산 부족 가능성';
    } else if (predictedRate < 0.5) {
      riskLevel = 'high';
      warning = '집행 부진: 불용 발생 가능성';
    } else if (predictedRate < 0.7 || predictedRate > 1.1) {
      riskLevel = 'medium';
      warning = '주의 필요: 집행 속도 조절 권장';
    }

    forecasts.push({
      itemId: item.itemId,
      category: classifyBudgetItem(item),
      currentRate,
      predictedRate,
      targetRate,
      riskLevel,
      warning,
    });
  }

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'BUDGET_FORECAST_GENERATED',
    target: tenantId,
    details: { itemsForecasted: forecasts.length, highRiskCount: forecasts.filter(f => f.riskLevel === 'high').length },
  });

  return forecasts;
}

// -- 벤치마크 비교 ────────────────────────────────────────────────────────────

/** 유사 기관 벤치마크 비교 -- FR-N297.5 */
export function benchmarkBudget(
  items: BudgetItem[],
): BenchmarkComparison[] {
  // 시뮬레이션: 카테고리별 평균 예산
  const avgBudgets: Record<string, number> = {
    '인건비': 5000000000,
    '사업비': 3000000000,
    '경상비': 1000000000,
    '이전지출': 2000000000,
    '예비비': 500000000,
    '기타': 800000000,
  };

  const categoryTotals = new Map<string, number>();
  for (const item of items) {
    const cat = classifyBudgetItem(item);
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + item.currentAmount);
  }

  const comparisons: BenchmarkComparison[] = [];
  for (const [category, orgAmount] of categoryTotals.entries()) {
    const avgAmount = avgBudgets[category] ?? 1000000000;
    const deviation = (orgAmount - avgAmount) / avgAmount;
    const percentile = Math.min(99, Math.max(1, 50 + deviation * 50));

    let assessment = '평균 범위';
    if (deviation > 0.5) assessment = '유사 기관 대비 상위 지출';
    else if (deviation < -0.3) assessment = '유사 기관 대비 하위 지출';

    comparisons.push({ category, orgAmount, avgAmount, deviation, percentile, assessment });
  }

  return comparisons;
}

// -- 리포트 생성 ──────────────────────────────────────────────────────────────

/** 예산 분석 리포트 생성 -- FR-N297.4 */
export function generateBudgetReport(
  tenantId: string,
  items: BudgetItem[],
  fiscalYear: number,
  currentMonth: number,
): BudgetAnalysisReport {
  const anomalies = detectBudgetAnomalies(tenantId, items);
  const forecasts = forecastExecution(tenantId, items, currentMonth);
  const benchmarks = benchmarkBudget(items);

  const totalBudget = items.reduce((s, i) => s + i.currentAmount, 0);
  const totalExecuted = items.reduce((s, i) => s + i.executedAmount, 0);
  const executionRate = totalBudget > 0 ? totalExecuted / totalBudget : 0;

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'BUDGET_REPORT_GENERATED',
    target: tenantId,
    details: { fiscalYear, totalBudget, executionRate, anomalyCount: anomalies.length },
  });

  return {
    reportId: `budget-rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    fiscalYear,
    totalBudget,
    totalExecuted,
    executionRate,
    anomalies,
    forecasts,
    benchmarks,
    generatedAt: new Date().toISOString(),
  };
}

/** 예산 AI 분석 서비스 */
export class BudgetAnalysisAIService {
  constructor(private readonly tenantId: string) {}

  detectAnomalies(items: BudgetItem[]): BudgetAnomaly[] {
    return detectBudgetAnomalies(this.tenantId, items);
  }

  forecast(items: BudgetItem[], currentMonth: number): ExecutionForecast[] {
    return forecastExecution(this.tenantId, items, currentMonth);
  }

  benchmark(items: BudgetItem[]): BenchmarkComparison[] {
    return benchmarkBudget(items);
  }

  generateReport(items: BudgetItem[], fiscalYear: number, currentMonth: number): BudgetAnalysisReport {
    return generateBudgetReport(this.tenantId, items, fiscalYear, currentMonth);
  }

  getAuditLog(): readonly BudgetAuditEntry[] {
    return getBudgetAuditLog(this.tenantId);
  }
}
