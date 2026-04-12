// 카오스 엔지니어링 AI 시나리오 생성기 -- FR-N377.1~FR-N377.5
// Design Ref: MTU-N377 | CSAP: D-06

export type FailureType =
  | 'pod_kill'
  | 'network_delay'
  | 'network_loss'
  | 'cpu_stress'
  | 'memory_stress'
  | 'disk_full'
  | 'dns_failure';

export interface ServiceNode {
  readonly name: string;
  readonly criticality: 'low' | 'medium' | 'high' | 'critical';
  readonly dependencies: readonly string[];
}

export interface ChaosScenario {
  readonly scenarioId: string;
  readonly target: string;
  readonly failureType: FailureType;
  readonly durationSec: number;
  readonly blastRadius: readonly string[];
  readonly safetyGuards: readonly string[];
  readonly hypothesis: string;
}

export interface ChaosAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: ChaosAuditEntry[] = [];

function recordAudit(entry: Omit<ChaosAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getChaosAuditLog(tenantId: string): readonly ChaosAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function computeBlastRadius(target: string, topology: readonly ServiceNode[]): readonly string[] {
  const affected = new Set<string>([target]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of topology) {
      if (node.dependencies.some((dep) => affected.has(dep)) && !affected.has(node.name)) {
        affected.add(node.name);
        changed = true;
      }
    }
  }
  return Array.from(affected);
}

function defaultGuards(failure: FailureType): string[] {
  const base = ['테스트 환경 한정', '최대 실행 5분', '자동 롤백'];
  if (failure === 'pod_kill') base.push('레플리카 최소 2 유지');
  if (failure === 'network_delay' || failure === 'network_loss') base.push('프로덕션 트래픽 배제');
  return base;
}

export function generateScenarios(
  tenantId: string,
  topology: readonly ServiceNode[],
  failureTypes: readonly FailureType[] = ['pod_kill', 'network_delay'],
): readonly ChaosScenario[] {
  const scenarios: ChaosScenario[] = [];
  let idx = 0;
  for (const node of topology) {
    if (node.criticality === 'critical') continue; // 안전 가드: critical 제외
    for (const ft of failureTypes) {
      const blast = computeBlastRadius(node.name, topology);
      scenarios.push({
        scenarioId: `cs-${idx++}`,
        target: node.name,
        failureType: ft,
        durationSec: 60,
        blastRadius: blast,
        safetyGuards: defaultGuards(ft),
        hypothesis: `${node.name}이(가) ${ft} 상황에서도 회복 가능해야 한다`,
      });
    }
  }
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'CHAOS_SCENARIOS_GENERATED',
    target: 'topology',
    details: { nodeCount: topology.length, scenarioCount: scenarios.length },
  });
  return scenarios;
}

export function validateSafety(scenario: ChaosScenario, maxBlastRadius: number): { safe: boolean; reason?: string } {
  if (scenario.blastRadius.length > maxBlastRadius) {
    return { safe: false, reason: `blast radius ${scenario.blastRadius.length} > ${maxBlastRadius}` };
  }
  if (scenario.safetyGuards.length === 0) {
    return { safe: false, reason: 'no safety guards' };
  }
  if (scenario.durationSec > 600) {
    return { safe: false, reason: 'duration exceeds 10 minutes' };
  }
  return { safe: true };
}

export class ChaosScenarioGeneratorService {
  constructor(private readonly tenantId: string) {}
  generate(topology: readonly ServiceNode[], failureTypes?: readonly FailureType[]): readonly ChaosScenario[] {
    return generateScenarios(this.tenantId, topology, failureTypes);
  }
  validate(scenario: ChaosScenario, maxBlast = 5): { safe: boolean; reason?: string } {
    return validateSafety(scenario, maxBlast);
  }
  getAuditLog(): readonly ChaosAuditEntry[] {
    return getChaosAuditLog(this.tenantId);
  }
}
