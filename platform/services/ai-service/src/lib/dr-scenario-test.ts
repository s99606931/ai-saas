// 자동 DR 시나리오 테스트 -- FR-N294.1~FR-N294.6
// Design Ref: MTU-N294 | CSAP: D-06, D-10

export type ScenarioCategory = 'database_failure' | 'network_partition' | 'pod_failure' | 'storage_failure' | 'region_failure';

export interface DRScenario {
  readonly scenarioId: string;
  readonly name: string;
  readonly category: ScenarioCategory;
  readonly targetSystem: string;
  readonly expectedRtoSec: number;
  readonly expectedRpoSec: number;
}

export interface DRTestResult {
  readonly resultId: string;
  readonly scenarioId: string;
  readonly tenantId: string;
  readonly executedAt: string;
  readonly success: boolean;
  readonly actualRtoSec: number;
  readonly actualRpoSec: number;
  readonly rtoMet: boolean;
  readonly rpoMet: boolean;
  readonly logs: readonly string[];
}

export interface DRReport {
  readonly reportId: string;
  readonly tenantId: string;
  readonly periodFrom: string;
  readonly periodTo: string;
  readonly totalScenarios: number;
  readonly passed: number;
  readonly failed: number;
  readonly rtoComplianceRate: number;
  readonly rpoComplianceRate: number;
  readonly results: readonly DRTestResult[];
}

export interface DRAuditEntry {
  readonly timestamp: string;
  readonly tenantId: string;
  readonly actor: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: DRAuditEntry[] = [];
const scenarioStore = new Map<string, DRScenario>();
const resultsStore: DRTestResult[] = [];

function recordAudit(entry: Omit<DRAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getDRAuditLog(tenantId: string): readonly DRAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

// FR-N294.1: 시나리오 등록
export function registerScenario(scenario: DRScenario): void {
  scenarioStore.set(scenario.scenarioId, scenario);
}

export function listScenarios(): readonly DRScenario[] {
  return Array.from(scenarioStore.values());
}

// FR-N294.2: 시나리오 시뮬레이션 + FR-N294.3: 복구 자동화 측정
export interface SimulationConfig {
  readonly mockFailureSec: number;
  readonly mockRecoverySec: number;
  readonly mockDataLossSec: number;
  readonly mockSuccess: boolean;
}

export function simulateScenario(
  scenarioId: string,
  tenantId: string,
  actor: string,
  config: SimulationConfig,
): DRTestResult {
  const scenario = scenarioStore.get(scenarioId);
  if (!scenario) {
    throw new Error(`SCENARIO_NOT_FOUND: ${scenarioId}`);
  }

  const logs: string[] = [
    `[INFO] 시나리오 시작: ${scenario.name}`,
    `[INFO] 장애 주입: ${config.mockFailureSec}s`,
    `[INFO] 복구 시도: ${config.mockRecoverySec}s`,
  ];
  if (!config.mockSuccess) {
    logs.push('[ERROR] 복구 실패');
  } else {
    logs.push('[INFO] 복구 완료');
  }

  const result: DRTestResult = {
    resultId: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    scenarioId,
    tenantId,
    executedAt: new Date().toISOString(),
    success: config.mockSuccess,
    actualRtoSec: config.mockRecoverySec,
    actualRpoSec: config.mockDataLossSec,
    rtoMet: config.mockSuccess && config.mockRecoverySec <= scenario.expectedRtoSec,
    rpoMet: config.mockSuccess && config.mockDataLossSec <= scenario.expectedRpoSec,
    logs,
  };
  resultsStore.push(result);

  recordAudit({
    tenantId,
    actor,
    action: 'DR_SCENARIO_EXECUTED',
    target: result.resultId,
    details: {
      scenarioId,
      success: config.mockSuccess,
      rtoMet: result.rtoMet,
      rpoMet: result.rpoMet,
    },
  });

  return result;
}

// FR-N294.4: DR 결과 분석 및 리포트
export function generateDRReport(
  tenantId: string,
  periodFrom: string,
  periodTo: string,
): DRReport {
  const filtered = resultsStore.filter(
    (r) => r.tenantId === tenantId && r.executedAt >= periodFrom && r.executedAt <= periodTo,
  );
  const passed = filtered.filter((r) => r.success).length;
  const failed = filtered.length - passed;
  const rtoMet = filtered.filter((r) => r.rtoMet).length;
  const rpoMet = filtered.filter((r) => r.rpoMet).length;
  const total = Math.max(filtered.length, 1);

  const report: DRReport = {
    reportId: `dr-rep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    periodFrom,
    periodTo,
    totalScenarios: filtered.length,
    passed,
    failed,
    rtoComplianceRate: rtoMet / total,
    rpoComplianceRate: rpoMet / total,
    results: filtered,
  };

  recordAudit({
    tenantId,
    actor: 'system',
    action: 'DR_REPORT_GENERATED',
    target: report.reportId,
    details: { totalScenarios: filtered.length, passed, failed },
  });

  return report;
}

// FR-N294.5: 정기 스케줄 (드라이런)
export interface DRSchedule {
  readonly scheduleId: string;
  readonly scenarioId: string;
  readonly cron: string;
  readonly enabled: boolean;
}

const schedules: DRSchedule[] = [];

export function scheduleScenario(s: DRSchedule): void {
  schedules.push(s);
}

export function listSchedules(): readonly DRSchedule[] {
  return schedules;
}

// FR-N294.6 + Service
export class DRScenarioTestService {
  constructor(private readonly tenantId: string) {}

  register(scenario: DRScenario): void {
    registerScenario(scenario);
  }

  simulate(scenarioId: string, config: SimulationConfig, actor: string = 'system'): DRTestResult {
    return simulateScenario(scenarioId, this.tenantId, actor, config);
  }

  report(periodFrom: string, periodTo: string): DRReport {
    return generateDRReport(this.tenantId, periodFrom, periodTo);
  }

  schedule(s: DRSchedule): void {
    scheduleScenario(s);
  }

  audit(): readonly DRAuditEntry[] {
    return getDRAuditLog(this.tenantId);
  }
}
