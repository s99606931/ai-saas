// Design Ref: docs/02-design/mtus/SVC-AI-ADV-R86.design.md
// Plan SC: FR-R86.1~5 (SVC-AI-ADV-R86 AI Graph Workflow Engine)
// CSAP: D-06 감사, D-12 개발 보안
//
// LangGraph 스타일 상태 기계 DAG. 조건부 분기, 체크포인트, 싸이클 방지.

export const END_NODE = 'END';

export type NodeFn<S> = (state: S) => Promise<Partial<S>> | Partial<S>;

export type EdgeCondition<S> = (state: S) => string;

interface NodeEntry<S> {
  id: string;
  fn: NodeFn<S>;
}

interface StaticEdge {
  from: string;
  to: string;
}

interface ConditionalEdge<S> {
  from: string;
  condition: EdgeCondition<S>;
}

export interface GraphConfig {
  maxSteps: number;
}

export interface GraphRunResult<S> {
  finalState: S;
  steps: number;
  path: string[];
  completed: boolean;
  reason: 'END' | 'MAX_STEPS' | 'ERROR';
  error?: string;
}

export interface Checkpoint<S> {
  id: string;
  state: S;
  path: string[];
  ts: number;
}

export interface AuditEvent {
  ts: string;
  action: 'NODE_RUN' | 'EDGE_TAKE' | 'CHECKPOINT' | 'COMPLETE' | 'FAILED';
  details: Record<string, unknown>;
}

export class AiGraphWorkflowEngine<S extends Record<string, unknown>> {
  private readonly nodes = new Map<string, NodeEntry<S>>();
  private readonly staticEdges: StaticEdge[] = [];
  private readonly conditionalEdges: ConditionalEdge<S>[] = [];
  private entryId: string | null = null;
  private readonly config: GraphConfig;
  private readonly auditLog: AuditEvent[] = [];
  private readonly checkpoints = new Map<string, Checkpoint<S>>();

  constructor(config: Partial<GraphConfig> = {}) {
    this.config = { maxSteps: config.maxSteps ?? 100 };
    if (this.config.maxSteps < 1) throw new Error('maxSteps must be >= 1');
  }

  /** FR-R86.1 */
  addNode(id: string, fn: NodeFn<S>): this {
    if (!id || id === END_NODE) throw new Error('invalid node id');
    if (this.nodes.has(id)) throw new Error(`node already exists: ${id}`);
    this.nodes.set(id, { id, fn });
    return this;
  }

  addEdge(from: string, to: string): this {
    if (!this.nodes.has(from)) throw new Error(`unknown from: ${from}`);
    if (to !== END_NODE && !this.nodes.has(to)) {
      throw new Error(`unknown to: ${to}`);
    }
    this.staticEdges.push({ from, to });
    return this;
  }

  /** FR-R86.2 */
  addConditionalEdge(from: string, condition: EdgeCondition<S>): this {
    if (!this.nodes.has(from)) throw new Error(`unknown from: ${from}`);
    this.conditionalEdges.push({ from, condition });
    return this;
  }

  setEntry(id: string): this {
    if (!this.nodes.has(id)) throw new Error(`unknown entry: ${id}`);
    this.entryId = id;
    return this;
  }

  /** FR-R86.3~4 */
  async run(initialState: S): Promise<GraphRunResult<S>> {
    if (!this.entryId) {
      return this.errorResult(initialState, [], 'entry not set');
    }
    let state: S = { ...initialState };
    let current: string = this.entryId;
    const path: string[] = [];

    for (let step = 0; step < this.config.maxSteps; step++) {
      if (current === END_NODE) {
        this.log('COMPLETE', { steps: step, path });
        return {
          finalState: state,
          steps: step,
          path,
          completed: true,
          reason: 'END',
        };
      }

      const node = this.nodes.get(current);
      if (!node) {
        return this.errorResult(state, path, `unknown node: ${current}`);
      }

      try {
        const partial = await node.fn(state);
        state = { ...state, ...partial };
        path.push(current);
        this.log('NODE_RUN', { node: current, step });
      } catch (e) {
        return this.errorResult(state, path, (e as Error).message);
      }

      const next = this.pickNext(current, state);
      if (!next) {
        return this.errorResult(state, path, `no outgoing edge from ${current}`);
      }
      this.log('EDGE_TAKE', { from: current, to: next });
      current = next;
    }

    this.log('FAILED', { reason: 'MAX_STEPS', path });
    return {
      finalState: state,
      steps: this.config.maxSteps,
      path,
      completed: false,
      reason: 'MAX_STEPS',
    };
  }

  /** FR-R86.5 */
  saveCheckpoint(id: string, state: S, path: string[]): void {
    this.checkpoints.set(id, {
      id,
      state: { ...state },
      path: [...path],
      ts: Date.now(),
    });
    this.log('CHECKPOINT', { id, pathLen: path.length });
  }

  loadCheckpoint(id: string): Checkpoint<S> | null {
    const cp = this.checkpoints.get(id);
    if (!cp) return null;
    return { ...cp, state: { ...cp.state }, path: [...cp.path] };
  }

  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog.slice();
  }

  private pickNext(from: string, state: S): string | null {
    const cond = this.conditionalEdges.find((c) => c.from === from);
    if (cond) {
      const next = cond.condition(state);
      if (next === END_NODE || this.nodes.has(next)) return next;
      return null;
    }
    const staticEdge = this.staticEdges.find((e) => e.from === from);
    return staticEdge ? staticEdge.to : null;
  }

  private errorResult(state: S, path: string[], msg: string): GraphRunResult<S> {
    this.log('FAILED', { reason: 'ERROR', msg });
    return {
      finalState: state,
      steps: path.length,
      path,
      completed: false,
      reason: 'ERROR',
      error: msg,
    };
  }

  private log(action: AuditEvent['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ ts: new Date().toISOString(), action, details });
  }
}

export function createAiGraphWorkflowEngine<S extends Record<string, unknown>>(
  config?: Partial<GraphConfig>,
): AiGraphWorkflowEngine<S> {
  return new AiGraphWorkflowEngine<S>(config);
}
