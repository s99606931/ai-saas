// AI 워크플로우 오케스트레이터 — FR-ADV14.1~FR-ADV14.6
// Design Ref: SVC-AI-ADV-R14 DESIGN §1~§3
// CSAP: D-12 시스템 개발 보안, D-06 감사 로깅
// N2SF: N-05 O등급 데이터만 처리

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 노드 상태 */
export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** 재시도 정책 — FR-ADV14.4 */
export interface RetryPolicy {
  /** 최대 재시도 횟수 (기본 3) */
  maxRetries: number;
  /** 기본 대기 시간 (ms, 기본 1000) */
  baseDelayMs: number;
  /** 재시도 불가 에러 유형 */
  nonRetryableErrors?: string[];
}

/** 조건부 분기 함수 — FR-ADV14.3 */
export type ConditionFn = (previousResults: Record<string, unknown>) => boolean;

/** 워크플로우 노드 정의 — FR-ADV14.1 */
export interface WorkflowNodeDefinition {
  /** 노드 ID (고유) */
  id: string;
  /** 노드 이름 (표시용) */
  name: string;
  /** 의존하는 노드 ID 목록 */
  dependencies: string[];
  /** 실행 함수 */
  handler: (input: Record<string, unknown>, context: WorkflowContext) => Promise<unknown>;
  /** 재시도 정책 */
  retryPolicy?: Partial<RetryPolicy>;
  /** 실행 조건 (false면 skip) */
  condition?: ConditionFn;
  /** 타임아웃 (ms) */
  timeoutMs?: number;
}

/** 워크플로우 정의 */
export interface WorkflowDefinition {
  /** 워크플로우 ID */
  id: string;
  /** 워크플로우 이름 */
  name: string;
  /** 노드 목록 */
  nodes: WorkflowNodeDefinition[];
}

/** 워크플로우 실행 컨텍스트 */
export interface WorkflowContext {
  workflowId: string;
  runId: string;
  /** 이전 노드 실행 결과 */
  results: Record<string, unknown>;
  /** 워크플로우 입력 데이터 */
  input: Record<string, unknown>;
  /** 현재 시도 횟수 */
  attempt: number;
}

/** 노드 실행 상태 */
export interface NodeExecutionState {
  nodeId: string;
  status: NodeStatus;
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  attempts: number;
  durationMs?: number;
}

/** 워크플로우 실행 결과 */
export interface WorkflowExecutionResult {
  runId: string;
  workflowId: string;
  status: 'completed' | 'failed' | 'partial';
  nodeStates: Map<string, NodeExecutionState>;
  results: Record<string, unknown>;
  startedAt: number;
  completedAt: number;
  totalDurationMs: number;
  completedNodes: number;
  failedNodes: number;
  skippedNodes: number;
}

/** 체크포인트 — FR-ADV14.5 */
export interface WorkflowCheckpoint {
  runId: string;
  workflowId: string;
  nodeStates: Record<string, NodeExecutionState>;
  results: Record<string, unknown>;
  input: Record<string, unknown>;
  createdAt: number;
}

/** 워크플로우 메트릭 — FR-ADV14.6 */
export interface WorkflowMetrics {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  avgDurationMs: number;
  nodeMetrics: Record<string, { avgDurationMs: number; failureRate: number; totalRuns: number }>;
}

// ── 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_RETRY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  nonRetryableErrors: ['VALIDATION_ERROR', 'PERMISSION_DENIED'],
};

const DEFAULT_TIMEOUT_MS = 60_000; // 1분

// ── ���크플로우 엔진 ──────────────────────────────────────────────────────────

/**
 * AI 워크플로우 오케스트레이터
 *
 * DAG(Directed Acyclic Graph) 기반으로 다단계 AI 작업을 자동화합니다.
 * 토폴로지 순서 실행, 병렬 처리, 조건부 분기, 재시도, 체크포인트를 지원합니다.
 */
export class WorkflowEngine {
  private readonly checkpoints: Map<string, WorkflowCheckpoint> = new Map();

  // 메트릭
  private totalRuns = 0;
  private completedRuns = 0;
  private failedRuns = 0;
  private totalDurationMs = 0;
  private nodeRunCounts: Map<string, number> = new Map();
  private nodeFailCounts: Map<string, number> = new Map();
  private nodeDurationSums: Map<string, number> = new Map();

  /**
   * 워크플로우를 실행합니다 — FR-ADV14.2
   */
  async execute(
    definition: WorkflowDefinition,
    input: Record<string, unknown>,
    checkpoint?: WorkflowCheckpoint,
  ): Promise<WorkflowExecutionResult> {
    const runId = checkpoint?.runId ?? crypto.randomUUID();
    const startedAt = Date.now();
    this.totalRuns++;

    // 노드 상태 초기화
    const nodeStates = new Map<string, NodeExecutionState>();
    const results: Record<string, unknown> = checkpoint?.results ?? {};

    for (const node of definition.nodes) {
      const savedState = checkpoint?.nodeStates[node.id];
      if (savedState && savedState.status === 'completed') {
        // 체크포인트에서 복원 — FR-ADV14.5
        nodeStates.set(node.id, savedState);
        if (savedState.result !== undefined) {
          results[node.id] = savedState.result;
        }
      } else {
        nodeStates.set(node.id, {
          nodeId: node.id,
          status: 'pending',
          attempts: 0,
        });
      }
    }

    // 토폴로지 정렬 실행
    const sortedNodes = this.topologicalSort(definition.nodes);

    for (const nodeId of sortedNodes) {
      const node = definition.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      const state = nodeStates.get(nodeId)!;

      // 이미 완료된 노드 스킵 (체크포인트)
      if (state.status === 'completed') continue;

      // 의존성 확인
      const depsCompleted = node.dependencies.every((dep) => {
        const depState = nodeStates.get(dep);
        return depState?.status === 'completed' || depState?.status === 'skipped';
      });

      if (!depsCompleted) {
        // 의존 노드가 실패했으면 스킵
        const depFailed = node.dependencies.some((dep) => nodeStates.get(dep)?.status === 'failed');
        if (depFailed) {
          state.status = 'skipped';
          continue;
        }
      }

      // 조건부 분기 — FR-ADV14.3
      if (node.condition && !node.condition(results)) {
        state.status = 'skipped';
        continue;
      }

      // 노드 실행 (재시도 포함) — FR-ADV14.4
      const retryPolicy = { ...DEFAULT_RETRY, ...node.retryPolicy };
      const timeoutMs = node.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      state.status = 'running';
      state.startedAt = Date.now();

      let lastError: string | undefined;
      let succeeded = false;

      for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
        state.attempts = attempt + 1;

        try {
          const context: WorkflowContext = {
            workflowId: definition.id,
            runId,
            results: { ...results },
            input,
            attempt,
          };

          // 타임아웃 래핑
          const result = await withTimeout(
            node.handler(input, context),
            timeoutMs,
          );

          state.result = result;
          state.status = 'completed';
          state.completedAt = Date.now();
          state.durationMs = state.completedAt - state.startedAt;
          results[nodeId] = result;
          succeeded = true;

          // 메트릭 갱신
          this.recordNodeMetric(nodeId, state.durationMs, false);

          // 체크포인트 저장 — FR-ADV14.5
          this.saveCheckpoint(runId, definition.id, nodeStates, results, input);

          break;
        } catch (error: unknown) {
          lastError = error instanceof Error ? error.message : '알 수 없는 오류';

          // 재시도 불가 에러 확���
          const isNonRetryable = retryPolicy.nonRetryableErrors?.some(
            (errType) => lastError?.includes(errType),
          );

          if (isNonRetryable || attempt >= retryPolicy.maxRetries) {
            break;
          }

          // 지수 백오프 대기
          const delay = retryPolicy.baseDelayMs * Math.pow(2, attempt);
          await sleep(delay);
        }
      }

      if (!succeeded) {
        state.status = 'failed';
        state.error = lastError;
        state.completedAt = Date.now();
        state.durationMs = state.completedAt - (state.startedAt ?? Date.now());
        this.recordNodeMetric(nodeId, state.durationMs, true);
      }
    }

    const completedAt = Date.now();
    const totalDurationMs = completedAt - startedAt;

    // 전체 상태 결정
    let completedNodes = 0;
    let failedNodes = 0;
    let skippedNodes = 0;

    for (const state of nodeStates.values()) {
      if (state.status === 'completed') completedNodes++;
      if (state.status === 'failed') failedNodes++;
      if (state.status === 'skipped') skippedNodes++;
    }

    const status = failedNodes > 0 ? 'failed' : completedNodes === definition.nodes.length - skippedNodes ? 'completed' : 'partial';

    if (status === 'completed') this.completedRuns++;
    if (status === 'failed') this.failedRuns++;
    this.totalDurationMs += totalDurationMs;

    return {
      runId,
      workflowId: definition.id,
      status,
      nodeStates,
      results,
      startedAt,
      completedAt,
      totalDurationMs,
      completedNodes,
      failedNodes,
      skippedNodes,
    };
  }

  /**
   * 체크포인트에서 워크플로우를 재개합니다 — FR-ADV14.5
   */
  async resume(
    definition: WorkflowDefinition,
    runId: string,
  ): Promise<WorkflowExecutionResult> {
    const checkpoint = this.checkpoints.get(runId);
    if (!checkpoint) {
      throw new Error(`체크포인트를 찾을 수 없습니다: ${runId}`);
    }
    return this.execute(definition, checkpoint.input, checkpoint);
  }

  /**
   * 워크플로우 메트릭을 반환합니다 — FR-ADV14.6
   */
  getMetrics(): WorkflowMetrics {
    const nodeMetrics: WorkflowMetrics['nodeMetrics'] = {};

    for (const [nodeId, totalRuns] of this.nodeRunCounts) {
      const failCount = this.nodeFailCounts.get(nodeId) ?? 0;
      const durationSum = this.nodeDurationSums.get(nodeId) ?? 0;

      nodeMetrics[nodeId] = {
        totalRuns,
        avgDurationMs: totalRuns > 0 ? Math.round(durationSum / totalRuns) : 0,
        failureRate: totalRuns > 0 ? failCount / totalRuns : 0,
      };
    }

    return {
      totalRuns: this.totalRuns,
      completedRuns: this.completedRuns,
      failedRuns: this.failedRuns,
      avgDurationMs: this.totalRuns > 0 ? Math.round(this.totalDurationMs / this.totalRuns) : 0,
      nodeMetrics,
    };
  }

  // ─��� 내부 메서드 ────────────────────────────────────────────────────

  /** 토폴로지 정렬 (Kahn's 알고리즘) */
  private topologicalSort(nodes: WorkflowNodeDefinition[]): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.id, node.dependencies.length);
      for (const dep of node.dependencies) {
        const neighbors = adjacency.get(dep) ?? [];
        neighbors.push(node.id);
        adjacency.set(dep, neighbors);
      }
    }

    const queue: string[] = [];
    for (const node of nodes) {
      if ((inDegree.get(node.id) ?? 0) === 0) {
        queue.push(node.id);
      }
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return sorted;
  }

  private saveCheckpoint(
    runId: string,
    workflowId: string,
    nodeStates: Map<string, NodeExecutionState>,
    results: Record<string, unknown>,
    input: Record<string, unknown>,
  ): void {
    const serializedStates: Record<string, NodeExecutionState> = {};
    for (const [key, state] of nodeStates) {
      serializedStates[key] = { ...state };
    }

    this.checkpoints.set(runId, {
      runId,
      workflowId,
      nodeStates: serializedStates,
      results: { ...results },
      input,
      createdAt: Date.now(),
    });
  }

  private recordNodeMetric(nodeId: string, durationMs: number, failed: boolean): void {
    this.nodeRunCounts.set(nodeId, (this.nodeRunCounts.get(nodeId) ?? 0) + 1);
    this.nodeDurationSums.set(nodeId, (this.nodeDurationSums.get(nodeId) ?? 0) + durationMs);
    if (failed) {
      this.nodeFailCounts.set(nodeId, (this.nodeFailCounts.get(nodeId) ?? 0) + 1);
    }
  }
}

// ── 유틸리티 ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`타임아웃: ${timeoutMs}ms 초과`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

export function createWorkflowEngine(): WorkflowEngine {
  return new WorkflowEngine();
}
