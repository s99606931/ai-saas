// 카오스 엔지니어링 자동화 -- FR-N307.1~FR-N307.6
// Design Ref: MTU-N307 DESIGN §1~§6
// Plan SC: SC-1 (실행성공 95%+), SC-2 (안전장치 100%), SC-3 (약점수정 80%+), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-13 변경관리

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 장애 유형 */
export type FaultType = 'network_latency' | 'network_partition' | 'process_kill' | 'disk_full' | 'cpu_stress' | 'memory_pressure' | 'dns_failure';

/** 실험 상태 */
export type ExperimentStatus = 'draft' | 'ready' | 'running' | 'completed' | 'aborted' | 'failed';

/** 카오스 실험 시나리오 */
export interface ChaosExperiment {
  readonly experimentId: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string;
  readonly faultType: FaultType;
  readonly targetService: string;
  readonly parameters: Record<string, unknown>;
  readonly blastRadius: number; // 0~100 (영향 범위)
  readonly durationSeconds: number;
  readonly sloThresholds: SLOThreshold[];
  readonly status: ExperimentStatus;
  readonly createdAt: string;
}

/** SLO 임계값 */
export interface SLOThreshold {
  readonly metric: string;
  readonly operator: 'lt' | 'gt' | 'lte' | 'gte';
  readonly value: number;
  readonly unit: string;
}

/** 안전 장치 */
export interface SafetyGuard {
  readonly guardId: string;
  readonly experimentId: string;
  readonly guardType: 'kill_switch' | 'blast_radius_limit' | 'slo_abort' | 'time_limit' | 'rollback';
  readonly enabled: boolean;
  readonly config: Record<string, unknown>;
}

/** 실험 결과 */
export interface ExperimentResult {
  readonly resultId: string;
  readonly experimentId: string;
  readonly tenantId: string;
  readonly status: 'success' | 'degraded' | 'failure';
  readonly metricsBeforeFault: Record<string, number>;
  readonly metricsDuringFault: Record<string, number>;
  readonly metricsAfterRecovery: Record<string, number>;
  readonly recoveryTimeSeconds: number;
  readonly sloViolations: string[];
  readonly weaknessesFound: string[];
  readonly startedAt: string;
  readonly completedAt: string;
}

/** 실험 리포트 */
export interface ChaosReport {
  readonly reportId: string;
  readonly tenantId: string;
  readonly experiment: ChaosExperiment;
  readonly result: ExperimentResult;
  readonly safetyGuardsTriggered: string[];
  readonly recommendations: string[];
  readonly resilienceScore: number; // 0~100
  readonly generatedAt: string;
}

/** 감사 로그 */
export interface ChaosAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: ChaosAuditEntry[] = [];

function recordAudit(entry: Omit<ChaosAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getChaosAuditLog(tenantId: string): readonly ChaosAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 실험 CRUD ────────────────────────────────────────────────────────────────

const experimentStore: Map<string, ChaosExperiment[]> = new Map();

/** 실험 시나리오 생성 -- FR-N307.1 */
export function createExperiment(
  tenantId: string,
  name: string,
  faultType: FaultType,
  targetService: string,
  durationSeconds: number = 60,
  blastRadius: number = 10,
  sloThresholds: SLOThreshold[] = [],
): ChaosExperiment {
  const experiment: ChaosExperiment = {
    experimentId: `chaos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    name,
    description: `${targetService} 대상 ${faultType} 장애 주입 실험`,
    faultType,
    targetService,
    parameters: { duration: durationSeconds, intensity: blastRadius },
    blastRadius,
    durationSeconds,
    sloThresholds: sloThresholds.length > 0 ? sloThresholds : [
      { metric: 'error_rate', operator: 'lt', value: 5, unit: '%' },
      { metric: 'p99_latency', operator: 'lt', value: 3000, unit: 'ms' },
    ],
    status: 'draft',
    createdAt: new Date().toISOString(),
  };

  const existing = experimentStore.get(tenantId) ?? [];
  existing.push(experiment);
  experimentStore.set(tenantId, existing);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'CHAOS_EXPERIMENT_CREATED',
    target: experiment.experimentId,
    details: { name, faultType, targetService, blastRadius },
  });

  return experiment;
}

/** 실험 목록 조회 */
export function getExperiments(tenantId: string): readonly ChaosExperiment[] {
  return experimentStore.get(tenantId) ?? [];
}

// -- 안전 장치 ────────────────────────────────────────────────────────────────

const guardStore: SafetyGuard[] = [];

/** 안전 장치 설정 -- FR-N307.3 */
export function setupSafetyGuards(experimentId: string): SafetyGuard[] {
  const guards: SafetyGuard[] = [
    {
      guardId: `guard-${Date.now()}-ks`,
      experimentId,
      guardType: 'kill_switch',
      enabled: true,
      config: { triggerUrl: '/api/chaos/abort', autoTrigger: true },
    },
    {
      guardId: `guard-${Date.now()}-br`,
      experimentId,
      guardType: 'blast_radius_limit',
      enabled: true,
      config: { maxPercentage: 20 },
    },
    {
      guardId: `guard-${Date.now()}-slo`,
      experimentId,
      guardType: 'slo_abort',
      enabled: true,
      config: { abortOnSLOViolation: true },
    },
    {
      guardId: `guard-${Date.now()}-tl`,
      experimentId,
      guardType: 'time_limit',
      enabled: true,
      config: { maxDurationSeconds: 300 },
    },
  ];

  guardStore.push(...guards);
  return guards;
}

// -- 장애 주입 실행 ──────────────────────────────────────────────────────────

const resultStore: ExperimentResult[] = [];

/** 장애 주입 실행 -- FR-N307.2 */
export function executeExperiment(
  tenantId: string,
  experimentId: string,
): ExperimentResult {
  const experiments = getExperiments(tenantId);
  const experiment = experiments.find(e => e.experimentId === experimentId);

  if (!experiment) {
    throw new Error(`실험 ${experimentId}을(를) 찾을 수 없습니다`);
  }

  // 시뮬레이션: 메트릭 생성
  const baseLatency = 100 + Math.random() * 50;
  const faultLatency = baseLatency * (1 + Math.random() * 3);
  const recoveryLatency = baseLatency * (1 + Math.random() * 0.5);
  const recoveryTime = 10 + Math.random() * 50;

  const sloViolations: string[] = [];
  for (const slo of experiment.sloThresholds) {
    if (slo.metric === 'p99_latency' && faultLatency > slo.value) {
      sloViolations.push(`${slo.metric}: ${faultLatency.toFixed(0)}${slo.unit} > ${slo.value}${slo.unit}`);
    }
  }

  const weaknesses: string[] = [];
  if (faultLatency > baseLatency * 3) {
    weaknesses.push(`${experiment.targetService}: 장애 시 레이턴시 ${(faultLatency / baseLatency).toFixed(1)}배 증가`);
  }
  if (recoveryTime > 30) {
    weaknesses.push(`${experiment.targetService}: 복구 시간 ${recoveryTime.toFixed(0)}초 (목표: 30초 이내)`);
  }

  const now = new Date();
  const result: ExperimentResult = {
    resultId: `result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    experimentId,
    tenantId,
    status: sloViolations.length > 0 ? 'degraded' : 'success',
    metricsBeforeFault: { p99_latency: baseLatency, error_rate: 0.1, throughput: 1000 },
    metricsDuringFault: { p99_latency: faultLatency, error_rate: 2 + Math.random() * 5, throughput: 500 + Math.random() * 300 },
    metricsAfterRecovery: { p99_latency: recoveryLatency, error_rate: 0.2, throughput: 950 },
    recoveryTimeSeconds: recoveryTime,
    sloViolations,
    weaknessesFound: weaknesses,
    startedAt: now.toISOString(),
    completedAt: new Date(now.getTime() + experiment.durationSeconds * 1000).toISOString(),
  };

  resultStore.push(result);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'CHAOS_EXPERIMENT_EXECUTED',
    target: experimentId,
    details: {
      status: result.status,
      recoveryTime: result.recoveryTimeSeconds,
      sloViolations: sloViolations.length,
      weaknessesFound: weaknesses.length,
    },
  });

  return result;
}

// -- 실험 리포트 ──────────────────────────────────────────────────────────────

/** 실험 리포트 생성 -- FR-N307.5 */
export function generateChaosReport(
  tenantId: string,
  experimentId: string,
): ChaosReport | null {
  const experiments = getExperiments(tenantId);
  const experiment = experiments.find(e => e.experimentId === experimentId);
  if (!experiment) return null;

  const result = resultStore.find(r => r.experimentId === experimentId);
  if (!result) return null;

  const recommendations: string[] = [];
  if (result.recoveryTimeSeconds > 30) {
    recommendations.push('복구 시간 개선: 자동 복구 메커니즘 강화');
  }
  if (result.sloViolations.length > 0) {
    recommendations.push('SLO 위반 대응: 서킷브레이커/폴백 구현 검토');
  }
  if (result.weaknessesFound.length > 0) {
    recommendations.push('발견된 약점 수정 후 재실험 권장');
  }

  const resilienceScore = Math.max(0, 100
    - (result.sloViolations.length * 15)
    - (result.weaknessesFound.length * 10)
    - (result.recoveryTimeSeconds > 60 ? 20 : 0),
  );

  return {
    reportId: `chaos-rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    experiment,
    result,
    safetyGuardsTriggered: result.status === 'failure' ? ['kill_switch'] : [],
    recommendations,
    resilienceScore,
    generatedAt: new Date().toISOString(),
  };
}

/** 카오스 엔지니어링 서비스 */
export class ChaosEngineeringService {
  constructor(private readonly tenantId: string) {}

  create(name: string, faultType: FaultType, target: string, duration?: number): ChaosExperiment {
    return createExperiment(this.tenantId, name, faultType, target, duration);
  }

  getExperiments(): readonly ChaosExperiment[] {
    return getExperiments(this.tenantId);
  }

  setupGuards(experimentId: string): SafetyGuard[] {
    return setupSafetyGuards(experimentId);
  }

  execute(experimentId: string): ExperimentResult {
    return executeExperiment(this.tenantId, experimentId);
  }

  report(experimentId: string): ChaosReport | null {
    return generateChaosReport(this.tenantId, experimentId);
  }

  getAuditLog(): readonly ChaosAuditEntry[] {
    return getChaosAuditLog(this.tenantId);
  }
}
