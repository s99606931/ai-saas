// Multi-Agent Collaboration Protocol — FR-R71.1~R71.5
// Design Ref: SVC-AI-ADV-R71 DESIGN §모듈
// Plan SC: 위임 왕복 99%, 순환 감지 100%
// CSAP: D-08 권한 분리, D-06 감사
// N2SF: N-05 등급 차단

export type DataGrade = 'C' | 'S' | 'O';

export interface AgentContract {
  agentId: string;
  capabilities: string[];
  maxDepth: number;
  allowedGrades: DataGrade[];
}

export type MessageKind = 'propose' | 'accept' | 'reject' | 'result' | 'aggregate';

export interface ProtocolMessage {
  id: string;
  kind: MessageKind;
  fromAgent: string;
  toAgent: string;
  taskId: string;
  parentTaskId?: string;
  capability: string;
  payload: string;
  grade: DataGrade;
  createdAt: number;
  depth: number;
}

export type TaskStatus =
  | 'proposed'
  | 'accepted'
  | 'rejected'
  | 'running'
  | 'done'
  | 'failed'
  | 'timeout';

export interface TaskRecord {
  taskId: string;
  parentTaskId?: string;
  rootTaskId: string;
  capability: string;
  assignedAgent?: string;
  status: TaskStatus;
  payload: string;
  result?: string;
  depth: number;
  path: string[];
  grade: DataGrade;
  createdAt: number;
  updatedAt: number;
}

export type AggregationStrategy = 'concat' | 'vote' | 'first';

export interface AggregationResult {
  rootTaskId: string;
  strategy: AggregationStrategy;
  result: string;
  subtaskCount: number;
}

export interface AuditEvent {
  event:
    | 'REGISTER'
    | 'PROPOSE'
    | 'ACCEPT'
    | 'REJECT'
    | 'RESULT'
    | 'AGGREGATE'
    | 'TIMEOUT'
    | 'CYCLE_BLOCK'
    | 'GRADE_BLOCK'
    | 'DEPTH_BLOCK'
    | 'CAP_BLOCK';
  taskId?: string;
  agent?: string;
  detail?: string;
  at: number;
}

export interface ProtocolOptions {
  timeoutMs?: number;
  defaultMaxDepth?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_DEPTH = 4;

export class MultiAgentProtocol {
  private readonly contracts = new Map<string, AgentContract>();
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly audit: AuditEvent[] = [];
  private readonly timeoutMs: number;
  private readonly defaultMaxDepth: number;
  private seq = 0;

  constructor(options: ProtocolOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultMaxDepth = options.defaultMaxDepth ?? DEFAULT_MAX_DEPTH;
  }

  // ── 에이전트 등록 ─────────────────────────────────────────────────────────
  register(contract: AgentContract): void {
    if (!contract.agentId) {
      throw new Error('PROTOCOL_AGENT_ID_REQUIRED');
    }
    if (contract.capabilities.length === 0) {
      throw new Error('PROTOCOL_CAPABILITIES_REQUIRED');
    }
    if (contract.maxDepth <= 0) {
      throw new Error('PROTOCOL_MAX_DEPTH_INVALID');
    }
    this.contracts.set(contract.agentId, { ...contract });
    this.audit.push({
      event: 'REGISTER',
      agent: contract.agentId,
      detail: contract.capabilities.join(','),
      at: Date.now(),
    });
  }

  getContract(agentId: string): AgentContract | undefined {
    return this.contracts.get(agentId);
  }

  // ── 태스크 제안 ───────────────────────────────────────────────────────────
  propose(args: {
    fromAgent: string;
    toAgent: string;
    capability: string;
    payload: string;
    grade: DataGrade;
    parentTaskId?: string;
  }): ProtocolMessage {
    const { fromAgent, toAgent, capability, payload, grade, parentTaskId } = args;

    if (grade === 'C' || grade === 'S') {
      this.audit.push({
        event: 'GRADE_BLOCK',
        agent: fromAgent,
        detail: `propose grade=${grade}`,
        at: Date.now(),
      });
      throw new Error('PROTOCOL_GRADE_BLOCKED');
    }

    const target = this.contracts.get(toAgent);
    if (!target) {
      throw new Error('PROTOCOL_TARGET_NOT_REGISTERED');
    }
    if (!target.capabilities.includes(capability)) {
      this.audit.push({
        event: 'CAP_BLOCK',
        agent: toAgent,
        detail: capability,
        at: Date.now(),
      });
      throw new Error('PROTOCOL_CAPABILITY_UNSUPPORTED');
    }
    if (!target.allowedGrades.includes(grade)) {
      this.audit.push({
        event: 'GRADE_BLOCK',
        agent: toAgent,
        detail: `target grade=${grade}`,
        at: Date.now(),
      });
      throw new Error('PROTOCOL_TARGET_GRADE_BLOCKED');
    }

    const parent = parentTaskId ? this.tasks.get(parentTaskId) : undefined;
    const parentPath = parent?.path ?? [];
    const parentDepth = parent?.depth ?? 0;
    const rootTaskId = parent?.rootTaskId ?? this.nextId('task');

    if (parentPath.includes(toAgent)) {
      this.audit.push({
        event: 'CYCLE_BLOCK',
        agent: toAgent,
        detail: parentPath.join('->'),
        at: Date.now(),
      });
      throw new Error('PROTOCOL_CYCLE_DETECTED');
    }

    const depth = parentDepth + 1;
    const maxDepth = Math.min(
      target.maxDepth,
      parent ? this.defaultMaxDepth : this.defaultMaxDepth,
    );
    if (depth > maxDepth) {
      this.audit.push({
        event: 'DEPTH_BLOCK',
        agent: toAgent,
        detail: `depth=${depth}`,
        at: Date.now(),
      });
      throw new Error('PROTOCOL_MAX_DEPTH_EXCEEDED');
    }

    const taskId = parent ? this.nextId('task') : rootTaskId;
    const now = Date.now();
    const record: TaskRecord = {
      taskId,
      parentTaskId,
      rootTaskId,
      capability,
      assignedAgent: toAgent,
      status: 'proposed',
      payload,
      depth,
      path: [...parentPath, fromAgent],
      grade,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(taskId, record);

    const msg: ProtocolMessage = {
      id: this.nextId('msg'),
      kind: 'propose',
      fromAgent,
      toAgent,
      taskId,
      parentTaskId,
      capability,
      payload,
      grade,
      createdAt: now,
      depth,
    };
    this.audit.push({
      event: 'PROPOSE',
      taskId,
      agent: `${fromAgent}->${toAgent}`,
      detail: capability,
      at: now,
    });
    return msg;
  }

  // ── 응답 ──────────────────────────────────────────────────────────────────
  respond(taskId: string, kind: 'accept' | 'reject', agent: string): TaskRecord {
    const task = this.mustTask(taskId);
    if (task.assignedAgent !== agent) {
      throw new Error('PROTOCOL_WRONG_RESPONDENT');
    }
    if (task.status !== 'proposed') {
      throw new Error('PROTOCOL_INVALID_STATE');
    }
    task.status = kind === 'accept' ? 'accepted' : 'rejected';
    task.updatedAt = Date.now();
    this.audit.push({
      event: kind === 'accept' ? 'ACCEPT' : 'REJECT',
      taskId,
      agent,
      at: task.updatedAt,
    });
    return task;
  }

  start(taskId: string, agent: string): TaskRecord {
    const task = this.mustTask(taskId);
    if (task.assignedAgent !== agent) {
      throw new Error('PROTOCOL_WRONG_RESPONDENT');
    }
    if (task.status !== 'accepted') {
      throw new Error('PROTOCOL_INVALID_STATE');
    }
    task.status = 'running';
    task.updatedAt = Date.now();
    return task;
  }

  // ── 결과 ──────────────────────────────────────────────────────────────────
  complete(taskId: string, agent: string, result: string): TaskRecord {
    const task = this.mustTask(taskId);
    if (task.assignedAgent !== agent) {
      throw new Error('PROTOCOL_WRONG_RESPONDENT');
    }
    if (task.status !== 'running' && task.status !== 'accepted') {
      throw new Error('PROTOCOL_INVALID_STATE');
    }
    task.status = 'done';
    task.result = result;
    task.updatedAt = Date.now();
    this.audit.push({ event: 'RESULT', taskId, agent, at: task.updatedAt });
    return task;
  }

  fail(taskId: string, agent: string, reason: string): TaskRecord {
    const task = this.mustTask(taskId);
    if (task.assignedAgent !== agent) {
      throw new Error('PROTOCOL_WRONG_RESPONDENT');
    }
    task.status = 'failed';
    task.result = reason;
    task.updatedAt = Date.now();
    return task;
  }

  // ── 집계 ──────────────────────────────────────────────────────────────────
  aggregate(rootTaskId: string, strategy: AggregationStrategy): AggregationResult {
    const related = Array.from(this.tasks.values()).filter(
      (t) => t.rootTaskId === rootTaskId && t.status === 'done',
    );
    if (related.length === 0) {
      throw new Error('PROTOCOL_NO_DONE_SUBTASKS');
    }
    let result = '';
    if (strategy === 'concat') {
      result = related.map((t) => t.result ?? '').join('\n');
    } else if (strategy === 'first') {
      result = related[0]?.result ?? '';
    } else {
      // vote
      const counts = new Map<string, number>();
      for (const t of related) {
        const v = t.result ?? '';
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      let best = '';
      let bestCount = -1;
      for (const [k, v] of counts) {
        if (v > bestCount) {
          best = k;
          bestCount = v;
        }
      }
      result = best;
    }
    this.audit.push({
      event: 'AGGREGATE',
      taskId: rootTaskId,
      detail: `${strategy}/${related.length}`,
      at: Date.now(),
    });
    return {
      rootTaskId,
      strategy,
      result,
      subtaskCount: related.length,
    };
  }

  // ── 타임아웃 ──────────────────────────────────────────────────────────────
  tick(now: number): number {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (
        (task.status === 'proposed' ||
          task.status === 'accepted' ||
          task.status === 'running') &&
        now - task.createdAt > this.timeoutMs
      ) {
        task.status = 'timeout';
        task.updatedAt = now;
        this.audit.push({
          event: 'TIMEOUT',
          taskId: task.taskId,
          agent: task.assignedAgent,
          at: now,
        });
        count += 1;
      }
    }
    return count;
  }

  // ── 조회 ──────────────────────────────────────────────────────────────────
  getTask(taskId: string): TaskRecord | undefined {
    const t = this.tasks.get(taskId);
    return t ? { ...t, path: [...t.path] } : undefined;
  }

  getTaskCount(): number {
    return this.tasks.size;
  }

  getAuditLog(): AuditEvent[] {
    return this.audit.map((e) => ({ ...e }));
  }

  // ── 내부 ──────────────────────────────────────────────────────────────────
  private mustTask(taskId: string): TaskRecord {
    const t = this.tasks.get(taskId);
    if (!t) {
      throw new Error('PROTOCOL_TASK_NOT_FOUND');
    }
    return t;
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.seq}`;
  }
}
