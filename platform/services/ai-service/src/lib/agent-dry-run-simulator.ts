// Design Ref: docs/02-design/mtus/SVC-AI-ADV-R76.design.md §3.1~3.3
// Plan SC: FR-R76.1~5 (SVC-AI-ADV-R76 Agent Dry-Run Simulator)
// CSAP: D-06 감사 로그, D-12 개발 보안 / N2SF: N-05 등급 차단
//
// 에이전트 계획(Plan)을 실제 실행 전에 가상으로 돌려 side-effect·위험도·차단
// 여부를 산출한다. 실제 도구 호출은 절대 수행하지 않는다 (부작용 0).

export type SideEffectKind = 'read' | 'write' | 'network' | 'delete' | 'exec';

export type DataGrade = 'O' | 'C' | 'S';

export interface ToolMeta {
  name: string;
  sideEffects: SideEffectKind[];
  riskWeight: number; // 0~1
  grade?: DataGrade;
}

export interface DryRunStep {
  stepId: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface DryRunPlan {
  planId: string;
  steps: DryRunStep[];
}

export interface DryRunReport {
  simId: string;
  planId: string;
  totalSteps: number;
  effects: Record<SideEffectKind, number>;
  riskScore: number;
  highRiskSteps: string[];
  blocked: boolean;
  blockedReason?: string;
  durationMs: number;
}

export interface AuditEvent {
  ts: string;
  actor: string;
  action: 'SIMULATE' | 'RISK_HIGH' | 'BLOCKED' | 'UNKNOWN_TOOL';
  target: string;
  grade?: DataGrade;
  details?: Record<string, unknown>;
}

const DEFAULT_HIGH_RISK_THRESHOLD = 0.7;

export class AgentDryRunSimulator {
  private readonly registry = new Map<string, ToolMeta>();
  private readonly auditLog: AuditEvent[] = [];
  private readonly threshold: number;

  constructor(tools: ToolMeta[] = [], threshold = DEFAULT_HIGH_RISK_THRESHOLD) {
    for (const t of tools) {
      this.validateTool(t);
      this.registry.set(t.name, t);
    }
    this.threshold = threshold;
  }

  /** FR-R76.1: 도구 등록 (side-effect 메타 포함) */
  registerTool(tool: ToolMeta): void {
    this.validateTool(tool);
    this.registry.set(tool.name, tool);
  }

  /** FR-R76.2~4: 계획을 가상 실행하고 보고서 산출 */
  simulate(plan: DryRunPlan, actor = 'system'): DryRunReport {
    const start = Date.now();
    const simId = `sim-${start}-${Math.random().toString(36).slice(2, 8)}`;
    const effects: Record<SideEffectKind, number> = {
      read: 0,
      write: 0,
      network: 0,
      delete: 0,
      exec: 0,
    };
    const highRiskSteps: string[] = [];
    let weightedSum = 0;
    let blocked = false;
    let blockedReason: string | undefined;

    for (const step of plan.steps) {
      const meta = this.registry.get(step.tool);
      if (!meta) {
        // 알려지지 않은 도구 → 고위험 간주, 실행 차단
        blocked = true;
        blockedReason = `Unknown tool: ${step.tool}`;
        highRiskSteps.push(step.stepId);
        this.record({
          ts: new Date().toISOString(),
          actor,
          action: 'UNKNOWN_TOOL',
          target: step.stepId,
          details: { tool: step.tool },
        });
        break;
      }

      // N2SF C/S 등급 도구 호출 시 즉시 차단
      if (meta.grade === 'C' || meta.grade === 'S') {
        blocked = true;
        blockedReason = `Blocked grade: ${meta.grade}`;
        this.record({
          ts: new Date().toISOString(),
          actor,
          action: 'BLOCKED',
          target: step.stepId,
          grade: meta.grade,
          details: { tool: step.tool, reason: blockedReason },
        });
        break;
      }

      for (const kind of meta.sideEffects) {
        effects[kind] += 1;
      }
      weightedSum += meta.riskWeight;

      // 개별 단계 위험 임계
      if (meta.riskWeight >= 0.7) {
        highRiskSteps.push(step.stepId);
      }
    }

    const totalSteps = plan.steps.length;
    const riskScore = totalSteps > 0 ? Math.min(1, weightedSum / totalSteps) : 0;

    if (!blocked && riskScore >= this.threshold) {
      this.record({
        ts: new Date().toISOString(),
        actor,
        action: 'RISK_HIGH',
        target: simId,
        details: { riskScore, highRiskSteps },
      });
    }

    const report: DryRunReport = {
      simId,
      planId: plan.planId,
      totalSteps,
      effects,
      riskScore,
      highRiskSteps,
      blocked,
      blockedReason,
      durationMs: Date.now() - start,
    };

    // FR-R76.5: 시뮬레이션 감사 로그
    this.record({
      ts: new Date().toISOString(),
      actor,
      action: 'SIMULATE',
      target: simId,
      details: {
        planId: plan.planId,
        totalSteps,
        riskScore,
        blocked,
      },
    });

    return report;
  }

  /** FR-R76.5: 감사 이력 조회 */
  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog.slice();
  }

  private validateTool(t: ToolMeta): void {
    if (!t.name || typeof t.name !== 'string') {
      throw new Error('ToolMeta.name required');
    }
    if (t.riskWeight < 0 || t.riskWeight > 1) {
      throw new Error('ToolMeta.riskWeight must be in [0,1]');
    }
    if (!Array.isArray(t.sideEffects)) {
      throw new Error('ToolMeta.sideEffects must be array');
    }
  }

  private record(ev: AuditEvent): void {
    // append-only: 외부에서 수정 불가하도록 복제본만 저장 관점에서
    // 여기서는 단일 프로세스 라이브러리이므로 push로 충분 (CSAP D-06).
    this.auditLog.push(ev);
  }
}

export function createAgentDryRunSimulator(
  tools: ToolMeta[] = [],
  threshold?: number,
): AgentDryRunSimulator {
  return new AgentDryRunSimulator(tools, threshold);
}
