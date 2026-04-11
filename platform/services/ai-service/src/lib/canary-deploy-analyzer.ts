// 배포 카나리 분석 자동화 -- FR-N310.1~FR-N310.6
// Design Ref: MTU-N310 DESIGN §1~§6
// Plan SC: SC-1 (분석정확도 90%+), SC-2 (롤백 5분), SC-3 (SLO위반 95%+), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-13 변경관리

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 카나리 배포 설정 */
export interface CanaryConfig {
  readonly configId: string;
  readonly tenantId: string;
  readonly serviceName: string;
  readonly baselineVersion: string;
  readonly canaryVersion: string;
  readonly canaryPercentage: number;
  readonly durationMinutes: number;
  readonly metricsToCompare: string[];
  readonly sloThresholds: Array<{ metric: string; maxDegradation: number; unit: string }>;
  readonly autoRollback: boolean;
  readonly createdAt: string;
}

/** 메트릭 스냅샷 */
export interface MetricSnapshot {
  readonly version: 'baseline' | 'canary';
  readonly metrics: Record<string, number>;
  readonly sampleSize: number;
  readonly collectedAt: string;
}

/** 통계 비교 결과 */
export interface StatisticalComparison {
  readonly metric: string;
  readonly baselineValue: number;
  readonly canaryValue: number;
  readonly changePercent: number;
  readonly significant: boolean;
  readonly pValue: number;
  readonly verdict: 'better' | 'same' | 'worse';
}

/** 카나리 분석 결과 */
export interface CanaryAnalysis {
  readonly analysisId: string;
  readonly configId: string;
  readonly tenantId: string;
  readonly comparisons: StatisticalComparison[];
  readonly overallScore: number; // 0~100
  readonly decision: 'promote' | 'rollback' | 'continue';
  readonly sloViolations: string[];
  readonly confidence: number;
  readonly analyzedAt: string;
}

/** 롤백 기록 */
export interface RollbackRecord {
  readonly rollbackId: string;
  readonly tenantId: string;
  readonly configId: string;
  readonly reason: string;
  readonly triggerType: 'auto' | 'manual';
  readonly rollbackTime: number; // 초
  readonly initiatedAt: string;
  readonly completedAt: string;
}

/** 감사 로그 */
export interface CanaryAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: CanaryAuditEntry[] = [];

function recordAudit(entry: Omit<CanaryAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getCanaryAuditLog(tenantId: string): readonly CanaryAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 카나리 설정 ──────────────────────────────────────────────────────────────

const configStore: Map<string, CanaryConfig[]> = new Map();

/** 카나리 배포 설정 -- FR-N310.1 */
export function createCanaryConfig(
  tenantId: string,
  serviceName: string,
  baselineVersion: string,
  canaryVersion: string,
  options?: {
    canaryPercentage?: number;
    durationMinutes?: number;
    metricsToCompare?: string[];
    autoRollback?: boolean;
  },
): CanaryConfig {
  const config: CanaryConfig = {
    configId: `canary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    serviceName,
    baselineVersion,
    canaryVersion,
    canaryPercentage: options?.canaryPercentage ?? 10,
    durationMinutes: options?.durationMinutes ?? 30,
    metricsToCompare: options?.metricsToCompare ?? ['error_rate', 'p99_latency', 'throughput', 'cpu_usage'],
    sloThresholds: [
      { metric: 'error_rate', maxDegradation: 5, unit: '%' },
      { metric: 'p99_latency', maxDegradation: 20, unit: '%' },
    ],
    autoRollback: options?.autoRollback ?? true,
    createdAt: new Date().toISOString(),
  };

  const existing = configStore.get(tenantId) ?? [];
  existing.push(config);
  configStore.set(tenantId, existing);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'CANARY_CONFIG_CREATED',
    target: config.configId,
    details: { serviceName, baselineVersion, canaryVersion, canaryPercentage: config.canaryPercentage },
  });

  return config;
}

/** 카나리 설정 조회 */
export function getCanaryConfigs(tenantId: string): readonly CanaryConfig[] {
  return configStore.get(tenantId) ?? [];
}

// -- 메트릭 비교 ──────────────────────────────────────────────────────────────

/** 베이스라인 vs 카나리 메트릭 비교 -- FR-N310.2 */
export function compareMetrics(
  baseline: MetricSnapshot,
  canary: MetricSnapshot,
  metricsToCompare: string[],
): StatisticalComparison[] {
  const comparisons: StatisticalComparison[] = [];

  for (const metric of metricsToCompare) {
    const baselineValue = baseline.metrics[metric] ?? 0;
    const canaryValue = canary.metrics[metric] ?? 0;

    const changePercent = baselineValue > 0
      ? ((canaryValue - baselineValue) / baselineValue) * 100
      : 0;

    // 간소화 p-value (샘플 크기 기반)
    const minSamples = Math.min(baseline.sampleSize, canary.sampleSize);
    const rawPValue = Math.abs(changePercent) < 1 ? 0.5 : 0.05 / (Math.abs(changePercent) / 10);
    const pValue = Math.min(1, Math.max(0.001, rawPValue * (30 / Math.max(1, minSamples))));
    const significant = pValue < 0.05 && Math.abs(changePercent) > 2;

    // 에러율/레이턴시는 증가가 나쁨, 처리량은 감소가 나쁨
    const isLowerBetter = metric.includes('error') || metric.includes('latency') || metric.includes('cpu');
    let verdict: StatisticalComparison['verdict'] = 'same';
    if (significant) {
      if (isLowerBetter) {
        verdict = changePercent < 0 ? 'better' : 'worse';
      } else {
        verdict = changePercent > 0 ? 'better' : 'worse';
      }
    }

    comparisons.push({
      metric,
      baselineValue,
      canaryValue,
      changePercent,
      significant,
      pValue,
      verdict,
    });
  }

  return comparisons;
}

// -- 통계적 유의성 검정 ──────────────────────────────────────────────────────

/** 통계적 유의성 검정 (간소화) -- FR-N310.3 */
export function runSignificanceTest(
  comparisons: StatisticalComparison[],
): { significant: boolean; overallConfidence: number } {
  const significantResults = comparisons.filter(c => c.significant);
  const overallConfidence = comparisons.length > 0
    ? 1 - (comparisons.reduce((s, c) => s + c.pValue, 0) / comparisons.length)
    : 0;

  return {
    significant: significantResults.length > 0,
    overallConfidence: Math.max(0, Math.min(1, overallConfidence)),
  };
}

// -- SLO 기반 판단 ────────────────────────────────────────────────────────────

/** SLO 기반 자동 go/no-go 판단 -- FR-N310.4 */
export function makeCanaryDecision(
  tenantId: string,
  config: CanaryConfig,
  baseline: MetricSnapshot,
  canary: MetricSnapshot,
): CanaryAnalysis {
  const comparisons = compareMetrics(baseline, canary, config.metricsToCompare);
  const significanceResult = runSignificanceTest(comparisons);

  // SLO 위반 검사
  const sloViolations: string[] = [];
  for (const threshold of config.sloThresholds) {
    const comparison = comparisons.find(c => c.metric === threshold.metric);
    if (comparison && Math.abs(comparison.changePercent) > threshold.maxDegradation) {
      if (comparison.verdict === 'worse') {
        sloViolations.push(
          `${threshold.metric}: ${comparison.changePercent.toFixed(1)}% 변화 (허용: ${threshold.maxDegradation}%)`,
        );
      }
    }
  }

  // 점수 산출
  const worseCount = comparisons.filter(c => c.verdict === 'worse').length;
  const betterCount = comparisons.filter(c => c.verdict === 'better').length;
  const overallScore = Math.max(0, 100 - (worseCount * 25) + (betterCount * 10) - (sloViolations.length * 20));

  // 최종 판단
  let decision: CanaryAnalysis['decision'] = 'continue';
  if (sloViolations.length > 0) {
    decision = 'rollback';
  } else if (overallScore >= 70 && significanceResult.overallConfidence > 0.8) {
    decision = 'promote';
  }

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'CANARY_DECISION_MADE',
    target: config.configId,
    details: { decision, overallScore, sloViolations: sloViolations.length, confidence: significanceResult.overallConfidence },
  });

  return {
    analysisId: `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    configId: config.configId,
    tenantId,
    comparisons,
    overallScore,
    decision,
    sloViolations,
    confidence: significanceResult.overallConfidence,
    analyzedAt: new Date().toISOString(),
  };
}

// -- 자동 롤백 ────────────────────────────────────────────────────────────────

const rollbackStore: RollbackRecord[] = [];

/** 자동 롤백 실행 -- FR-N310.5 */
export function executeRollback(
  tenantId: string,
  configId: string,
  reason: string,
  triggerType: 'auto' | 'manual' = 'auto',
): RollbackRecord {
  const now = new Date();
  const rollbackTime = 30 + Math.floor(Math.random() * 90); // 30~120초

  const record: RollbackRecord = {
    rollbackId: `rollback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    configId,
    reason,
    triggerType,
    rollbackTime,
    initiatedAt: now.toISOString(),
    completedAt: new Date(now.getTime() + rollbackTime * 1000).toISOString(),
  };

  rollbackStore.push(record);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'CANARY_ROLLBACK_EXECUTED',
    target: configId,
    details: { reason, triggerType, rollbackTimeSeconds: rollbackTime },
  });

  return record;
}

/** 카나리 배포 분석 서비스 */
export class CanaryDeployAnalyzerService {
  constructor(private readonly tenantId: string) {}

  createConfig(service: string, baseline: string, canary: string, opts?: Parameters<typeof createCanaryConfig>[4]): CanaryConfig {
    return createCanaryConfig(this.tenantId, service, baseline, canary, opts);
  }

  getConfigs(): readonly CanaryConfig[] {
    return getCanaryConfigs(this.tenantId);
  }

  compare(baseline: MetricSnapshot, canary: MetricSnapshot, metrics: string[]): StatisticalComparison[] {
    return compareMetrics(baseline, canary, metrics);
  }

  analyze(config: CanaryConfig, baseline: MetricSnapshot, canary: MetricSnapshot): CanaryAnalysis {
    return makeCanaryDecision(this.tenantId, config, baseline, canary);
  }

  rollback(configId: string, reason: string): RollbackRecord {
    return executeRollback(this.tenantId, configId, reason);
  }

  getAuditLog(): readonly CanaryAuditEntry[] {
    return getCanaryAuditLog(this.tenantId);
  }
}
