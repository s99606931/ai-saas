// Tool-Use Planner — FR-R61.1~R61.6
// Design Ref: SVC-AI-ADV-R61 DESIGN §모듈 구조
// Plan SC: 3단계 이상 골 성공률 ≥ 85%
// CSAP: D-06 감사 / D-08 접근통제
// N2SF: C/S 등급 차단

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type DataGrade = 'C' | 'S' | 'O';
export type NodeStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface Tool {
  id: string;
  name: string;
  requiredRole: string;
  run(args: Record<string, unknown>): Promise<unknown>;
}

export interface PlanNode {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  /** 선행 노드 id */
  deps: string[];
  /** 대체 tool id 목록 (백트래킹용) */
  alternatives: string[];
  status: NodeStatus;
  attempts: number;
  output?: unknown;
  error?: string;
}

export interface PlanResult {
  success: boolean;
  steps: PlanNode[];
  finalOutput?: unknown;
}

export interface Principal {
  userId: string;
  roles: string[];
}

export interface PlannerLimits {
  maxDepth: number;
  maxRetriesPerNode: number;
  maxTotalSteps: number;
}

export interface PlannerAuditEntry {
  timestamp: string;
  action:
    | 'PLAN_BUILT'
    | 'TOOL_EXECUTED'
    | 'TOOL_FAILED'
    | 'BACKTRACK'
    | 'PERMISSION_DENIED'
    | 'LIMIT_EXCEEDED'
    | 'GRADE_BLOCKED';
  nodeId?: string;
  detail?: string;
}

export interface GoalSpec {
  /** 자연어 목표 (감사용) */
  goal: string;
  /** 이미 DAG로 작성된 노드 스켈레톤 */
  nodes: Array<Omit<PlanNode, 'status' | 'attempts'>>;
}

// ── ToolUsePlanner ───────────────────────────────────────────────────────────

const DEFAULT_LIMITS: PlannerLimits = {
  maxDepth: 5,
  maxRetriesPerNode: 3,
  maxTotalSteps: 30,
};

export class ToolUsePlanner {
  private readonly tools = new Map<string, Tool>();
  private readonly auditLog: PlannerAuditEntry[] = [];
  private readonly limits: PlannerLimits;

  constructor(limits: Partial<PlannerLimits> = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    if (this.limits.maxDepth <= 0) throw new Error('TP_INVALID_DEPTH');
    if (this.limits.maxRetriesPerNode <= 0) throw new Error('TP_INVALID_RETRY');
    if (this.limits.maxTotalSteps <= 0) throw new Error('TP_INVALID_STEPS');
  }

  registerTool(tool: Tool): void {
    if (!tool.id) throw new Error('TP_INVALID_TOOL');
    this.tools.set(tool.id, tool);
  }

  // FR-R61.6: 등급 검사
  enforceDataGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      this.audit('GRADE_BLOCKED', undefined, `N2SF ${grade}`);
      throw new Error(`BLOCKED: ${grade}등급 데이터는 도구 실행 금지 (N2SF N-05)`);
    }
  }

  // FR-R61.1: 플랜 빌드 (DAG 검증)
  plan(spec: GoalSpec): PlanNode[] {
    if (!spec.nodes || spec.nodes.length === 0) {
      throw new Error('TP_EMPTY_PLAN');
    }
    if (spec.nodes.length > this.limits.maxTotalSteps) {
      this.audit('LIMIT_EXCEEDED', undefined, `steps=${spec.nodes.length}`);
      throw new Error('TP_TOO_MANY_STEPS');
    }

    const ids = new Set(spec.nodes.map((n) => n.id));
    for (const n of spec.nodes) {
      if (!this.tools.has(n.tool)) throw new Error(`TP_UNKNOWN_TOOL:${n.tool}`);
      for (const d of n.deps) {
        if (!ids.has(d)) throw new Error(`TP_UNKNOWN_DEP:${d}`);
      }
    }
    this.assertDagAndDepth(spec.nodes);

    const plan: PlanNode[] = spec.nodes.map((n) => ({
      ...n,
      status: 'pending',
      attempts: 0,
    }));
    this.audit('PLAN_BUILT', undefined, `goal="${spec.goal}" steps=${plan.length}`);
    return plan;
  }

  // FR-R61.5
  checkToolPermission(user: Principal, toolId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) return false;
    const allowed = user.roles.includes(tool.requiredRole) || user.roles.includes('admin');
    if (!allowed) {
      this.audit('PERMISSION_DENIED', toolId, `user=${user.userId}`);
    }
    return allowed;
  }

  // FR-R61.2: 플랜 실행
  async execute(
    plan: PlanNode[],
    user: Principal,
    grade: DataGrade = 'O',
  ): Promise<PlanResult> {
    this.enforceDataGrade(grade);

    const byId = new Map<string, PlanNode>();
    for (const n of plan) byId.set(n.id, n);

    let safety = this.limits.maxTotalSteps * (this.limits.maxRetriesPerNode + 1);
    let lastOutput: unknown;

    while (safety-- > 0) {
      const next = this.pickNext(plan);
      if (!next) break;

      if (!this.checkToolPermission(user, next.tool)) {
        next.status = 'failed';
        next.error = 'PERMISSION_DENIED';
        continue;
      }

      const tool = this.tools.get(next.tool);
      if (!tool) {
        next.status = 'failed';
        next.error = 'UNKNOWN_TOOL';
        continue;
      }

      next.attempts += 1;
      try {
        const out = await tool.run(next.args);
        next.status = 'success';
        next.output = out;
        lastOutput = out;
        this.audit('TOOL_EXECUTED', next.id, `tool=${next.tool}`);
      } catch (e) {
        next.error = (e as Error).message;
        this.audit('TOOL_FAILED', next.id, next.error);
        if (next.attempts >= this.limits.maxRetriesPerNode) {
          // FR-R61.3: 백트래킹 — 대체 tool 시도
          const replaced = this.backtrack(next);
          if (!replaced) {
            next.status = 'failed';
          } else {
            this.audit('BACKTRACK', next.id, `alt=${replaced}`);
          }
        }
      }
    }

    const failed = plan.find((n) => n.status === 'failed');
    return {
      success: !failed,
      steps: plan,
      ...(lastOutput !== undefined ? { finalOutput: lastOutput } : {}),
    };
  }

  // FR-R61.3: 백트래킹 — 대체 도구 교체
  backtrack(node: PlanNode): string | null {
    while (node.alternatives.length > 0) {
      const alt = node.alternatives.shift();
      if (alt && this.tools.has(alt)) {
        node.tool = alt;
        node.attempts = 0;
        node.status = 'pending';
        delete node.error;
        return alt;
      }
    }
    return null;
  }

  getAuditLog(limit?: number): PlannerAuditEntry[] {
    const copy = this.auditLog.map((e) => ({ ...e }));
    if (limit !== undefined && limit > 0) return copy.slice(-limit);
    return copy;
  }

  getLimits(): PlannerLimits {
    return { ...this.limits };
  }

  // ── 내부 ───────────────────────────────────────────────────────────────────

  private pickNext(plan: PlanNode[]): PlanNode | null {
    const byId = new Map(plan.map((n) => [n.id, n] as const));
    for (const n of plan) {
      if (n.status !== 'pending') continue;
      const depsOk = n.deps.every((d) => byId.get(d)?.status === 'success');
      if (depsOk) return n;
    }
    return null;
  }

  private assertDagAndDepth(
    nodes: Array<Omit<PlanNode, 'status' | 'attempts'>>,
  ): void {
    // deps → id 방향 (deps는 선행 노드)
    // 길이 = 노드의 최장 의존 경로 길이
    const byId = new Map<string, Omit<PlanNode, 'status' | 'attempts'>>();
    for (const n of nodes) byId.set(n.id, n);

    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    const depthMemo = new Map<string, number>();
    for (const n of nodes) color.set(n.id, WHITE);

    const dfs = (id: string): number => {
      const cached = depthMemo.get(id);
      if (cached !== undefined) return cached;
      const c = color.get(id);
      if (c === GRAY) throw new Error('TP_CYCLE_DETECTED');
      color.set(id, GRAY);
      const n = byId.get(id);
      let d = 1;
      if (n) {
        for (const dep of n.deps) {
          const sub = dfs(dep) + 1;
          if (sub > d) d = sub;
        }
      }
      if (d > this.limits.maxDepth) {
        throw new Error('TP_DEPTH_EXCEEDED');
      }
      color.set(id, BLACK);
      depthMemo.set(id, d);
      return d;
    };

    for (const n of nodes) dfs(n.id);
  }

  private audit(
    action: PlannerAuditEntry['action'],
    nodeId?: string,
    detail?: string,
  ): void {
    const entry: PlannerAuditEntry = {
      timestamp: new Date().toISOString(),
      action,
    };
    if (nodeId !== undefined) entry.nodeId = nodeId;
    if (detail !== undefined) entry.detail = detail;
    this.auditLog.push(entry);
  }
}
