// 워크플로우 실행 엔진
// Design Ref: SVC-WORKFLOW-R20 Plan
// Plan SC: FR-WF.2, FR-WF.3, FR-WF.4, FR-WF.5, FR-WF.6, FR-WF.8
// CSAP: D-06 침해사고 관리 (감사 추적), D-10 접근 제어

import type {
  WorkflowDefinition,
  WorkflowInstance,
  StepResult,
  WorkflowStatus,
  StepStatus,
} from './workflow-definition.js';

/**
 * 이벤트 리스너 타입
 */
export type WorkflowEventListener = (event: WorkflowEvent) => void;

/**
 * 워크플로우 이벤트
 */
export interface WorkflowEvent {
  /** 이벤트 유형 */
  type: WorkflowEventType;
  /** 워크플로우 인스턴스 ID */
  instanceId: string;
  /** 워크플로우 이름 */
  workflowName: string;
  /** 관련 단계 이름 (해당 시) */
  stepName?: string;
  /** 이전 상태 */
  previousStatus?: string;
  /** 새 상태 */
  newStatus: string;
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 타임스탬프 */
  timestamp: string;
}

export type WorkflowEventType =
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.compensating'
  | 'workflow.compensated'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'step.retrying'
  | 'step.compensating'
  | 'step.compensated';

/**
 * 워크플로우 엔진 옵션
 */
export interface WorkflowEngineOptions {
  /** 최대 동시 실행 워크플로우 수 (기본: 100) */
  maxConcurrent?: number;
  /** 완료된 인스턴스 보존 개수 (기본: 1000) */
  maxRetainedInstances?: number;
}

/**
 * 워크플로우 엔진 통계
 */
export interface WorkflowEngineStats {
  /** 등록된 워크플로우 정의 수 */
  registeredWorkflows: number;
  /** 활성 인스턴스 수 */
  activeInstances: number;
  /** 완료 인스턴스 수 */
  completedInstances: number;
  /** 실패 인스턴스 수 */
  failedInstances: number;
  /** 총 인스턴스 수 */
  totalInstances: number;
}

/**
 * 워크플로우 실행 엔진
 *
 * Step 기반 상태 머신으로 워크플로우를 실행합니다.
 * - 각 단계를 순차 실행하고 공유 컨텍스트로 데이터 전달
 * - 실패 시 Saga 보상 트랜잭션을 역순 실행
 * - 단계별 재시도 + 지수 백오프
 * - 단계별 타임아웃 지원
 * - 모든 상태 전이 이벤트 발행 (감사 추적)
 */
export class WorkflowEngine {
  private readonly definitions = new Map<string, WorkflowDefinition>();
  private readonly instances = new Map<string, WorkflowInstance>();
  private readonly listeners: WorkflowEventListener[] = [];
  private readonly maxConcurrent: number;
  private readonly maxRetainedInstances: number;
  private idCounter = 0;

  constructor(options: WorkflowEngineOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 100;
    this.maxRetainedInstances = options.maxRetainedInstances ?? 1000;
  }

  /**
   * 워크플로우 정의 등록
   */
  register(definition: WorkflowDefinition): void {
    const key = `${definition.name}@${definition.version}`;
    this.definitions.set(key, definition);
  }

  /**
   * 등록된 워크플로우 정의 조회
   */
  getDefinition(name: string, version: string): WorkflowDefinition | undefined {
    return this.definitions.get(`${name}@${version}`);
  }

  /**
   * 등록된 워크플로우 목록
   */
  getRegisteredWorkflows(): Array<{ name: string; version: string }> {
    return Array.from(this.definitions.values()).map((d) => ({
      name: d.name,
      version: d.version,
    }));
  }

  /**
   * 이벤트 리스너 등록
   */
  onEvent(listener: WorkflowEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * 워크플로우 실행 시작
   *
   * @param name 워크플로우 이름
   * @param version 워크플로우 버전
   * @param initialContext 초기 컨텍스트
   * @returns 워크플로우 인스턴스 (실행 완료 후)
   */
  async execute<TContext extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
    version: string,
    initialContext: TContext = {} as TContext,
  ): Promise<WorkflowInstance<TContext>> {
    const definition = this.definitions.get(`${name}@${version}`);
    if (!definition) {
      throw new Error(`워크플로우 미등록: ${name}@${version}`);
    }

    // 동시 실행 제한 검사
    const activeCount = this.getActiveCount();
    if (activeCount >= this.maxConcurrent) {
      throw new Error(
        `동시 실행 한도 초과: ${activeCount}/${this.maxConcurrent}`,
      );
    }

    const instance = this.createInstance<TContext>(definition, initialContext);
    this.instances.set(instance.id, instance as WorkflowInstance);

    this.emitEvent({
      type: 'workflow.started',
      instanceId: instance.id,
      workflowName: name,
      newStatus: 'running',
      timestamp: new Date().toISOString(),
    });

    try {
      await this.runSteps(definition, instance);

      if (instance.status === 'running') {
        this.updateStatus(instance, 'completed');
        instance.completedAt = new Date().toISOString();
        instance.totalDurationMs =
          new Date(instance.completedAt).getTime() -
          new Date(instance.createdAt).getTime();

        this.emitEvent({
          type: 'workflow.completed',
          instanceId: instance.id,
          workflowName: name,
          previousStatus: 'running',
          newStatus: 'completed',
          timestamp: instance.completedAt,
        });
      }
    } catch (err) {
      // 보상 트랜잭션이 이미 처리됨 -- 최종 상태만 기록
      if (instance.status !== 'compensated' && instance.status !== 'failed') {
        this.updateStatus(instance, 'failed');
      }
      instance.completedAt = new Date().toISOString();
      instance.totalDurationMs =
        new Date(instance.completedAt).getTime() -
        new Date(instance.createdAt).getTime();
    }

    this.pruneInstances();
    return instance;
  }

  /**
   * 워크플로우 인스턴스 조회
   */
  getInstance(id: string): WorkflowInstance | undefined {
    return this.instances.get(id);
  }

  /**
   * 상태별 인스턴스 목록 조회
   */
  getInstancesByStatus(status: WorkflowStatus): WorkflowInstance[] {
    const result: WorkflowInstance[] = [];
    for (const instance of this.instances.values()) {
      if (instance.status === status) {
        result.push(instance);
      }
    }
    return result;
  }

  /**
   * 모든 인스턴스 조회
   */
  getAllInstances(): WorkflowInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * 엔진 통계
   */
  getStats(): WorkflowEngineStats {
    let active = 0;
    let completed = 0;
    let failed = 0;

    for (const inst of this.instances.values()) {
      if (inst.status === 'running' || inst.status === 'compensating') {
        active++;
      } else if (inst.status === 'completed') {
        completed++;
      } else if (inst.status === 'failed' || inst.status === 'compensated') {
        failed++;
      }
    }

    return {
      registeredWorkflows: this.definitions.size,
      activeInstances: active,
      completedInstances: completed,
      failedInstances: failed,
      totalInstances: this.instances.size,
    };
  }

  /**
   * 전체 리셋 (테스트용)
   */
  reset(): void {
    this.definitions.clear();
    this.instances.clear();
    this.listeners.length = 0;
    this.idCounter = 0;
  }

  // ── 내부 메서드 ─────────────────────────────────────────

  private createInstance<TContext extends Record<string, unknown>>(
    definition: WorkflowDefinition,
    initialContext: TContext,
  ): WorkflowInstance<TContext> {
    const id = `wf-${++this.idCounter}-${Date.now()}`;
    const now = new Date().toISOString();

    const stepResults: StepResult[] = definition.steps.map((step) => ({
      name: step.name,
      status: 'pending' as StepStatus,
      startedAt: null,
      completedAt: null,
      attempts: 0,
      error: null,
      durationMs: null,
    }));

    return {
      id,
      workflowName: definition.name,
      workflowVersion: definition.version,
      status: 'running',
      context: { ...initialContext },
      currentStepIndex: 0,
      stepResults,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      totalDurationMs: null,
    };
  }

  private async runSteps(
    definition: WorkflowDefinition,
    instance: WorkflowInstance,
  ): Promise<void> {
    const { steps } = definition;

    for (let i = 0; i < steps.length; i++) {
      instance.currentStepIndex = i;
      const step = steps[i]!;
      const stepResult = instance.stepResults[i]!;

      const maxRetries = step.maxRetries ?? definition.defaultMaxRetries ?? 3;
      const timeoutMs = step.timeoutMs ?? definition.defaultTimeoutMs ?? 30_000;
      const retryDelayMs = step.retryDelayMs ?? definition.defaultRetryDelayMs ?? 100;

      stepResult.status = 'running';
      stepResult.startedAt = new Date().toISOString();

      this.emitEvent({
        type: 'step.started',
        instanceId: instance.id,
        workflowName: definition.name,
        stepName: step.name,
        newStatus: 'running',
        timestamp: stepResult.startedAt,
      });

      let lastError: Error | null = null;
      let succeeded = false;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        stepResult.attempts = attempt + 1;

        try {
          const result = await this.executeStepWithTimeout(
            step.execute,
            instance.context,
            timeoutMs,
          );

          // 실행 결과를 컨텍스트에 병합
          if (result && typeof result === 'object') {
            Object.assign(instance.context, result);
          }

          succeeded = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt < maxRetries) {
            this.emitEvent({
              type: 'step.retrying',
              instanceId: instance.id,
              workflowName: definition.name,
              stepName: step.name,
              newStatus: 'running',
              error: lastError.message,
              timestamp: new Date().toISOString(),
            });

            // 지수 백오프
            const delay = retryDelayMs * Math.pow(2, attempt);
            await this.sleep(delay);
          }
        }
      }

      if (succeeded) {
        stepResult.status = 'completed';
        stepResult.completedAt = new Date().toISOString();
        stepResult.durationMs =
          new Date(stepResult.completedAt).getTime() -
          new Date(stepResult.startedAt).getTime();

        this.emitEvent({
          type: 'step.completed',
          instanceId: instance.id,
          workflowName: definition.name,
          stepName: step.name,
          previousStatus: 'running',
          newStatus: 'completed',
          timestamp: stepResult.completedAt,
        });
      } else {
        // 단계 실패 → 보상 트랜잭션
        stepResult.status = 'failed';
        stepResult.error = lastError?.message ?? 'Unknown error';
        stepResult.completedAt = new Date().toISOString();
        stepResult.durationMs =
          new Date(stepResult.completedAt).getTime() -
          new Date(stepResult.startedAt).getTime();

        this.emitEvent({
          type: 'step.failed',
          instanceId: instance.id,
          workflowName: definition.name,
          stepName: step.name,
          previousStatus: 'running',
          newStatus: 'failed',
          error: stepResult.error,
          timestamp: stepResult.completedAt,
        });

        // 나머지 단계 건너뛰기
        for (let j = i + 1; j < steps.length; j++) {
          instance.stepResults[j]!.status = 'skipped';
        }

        // 보상 트랜잭션 실행
        await this.runCompensation(definition, instance, i);
        return;
      }
    }
  }

  private async runCompensation(
    definition: WorkflowDefinition,
    instance: WorkflowInstance,
    failedStepIndex: number,
  ): Promise<void> {
    this.updateStatus(instance, 'compensating');

    this.emitEvent({
      type: 'workflow.compensating',
      instanceId: instance.id,
      workflowName: definition.name,
      previousStatus: 'running',
      newStatus: 'compensating',
      timestamp: new Date().toISOString(),
    });

    // 실패 단계 바로 전부터 역순으로 보상
    for (let i = failedStepIndex - 1; i >= 0; i--) {
      const step = definition.steps[i]!;
      const stepResult = instance.stepResults[i]!;

      if (!step.compensate) {
        continue;
      }

      stepResult.status = 'compensating';
      this.emitEvent({
        type: 'step.compensating',
        instanceId: instance.id,
        workflowName: definition.name,
        stepName: step.name,
        newStatus: 'compensating',
        timestamp: new Date().toISOString(),
      });

      try {
        await step.compensate(instance.context);
        stepResult.status = 'compensated';

        this.emitEvent({
          type: 'step.compensated',
          instanceId: instance.id,
          workflowName: definition.name,
          stepName: step.name,
          previousStatus: 'compensating',
          newStatus: 'compensated',
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        // 보상 트랜잭션 실패 -- 로깅 후 계속 진행 (최선의 노력)
        const error = err instanceof Error ? err.message : String(err);
        stepResult.error = `보상 실패: ${error}`;
        stepResult.status = 'failed';

        this.emitEvent({
          type: 'step.failed',
          instanceId: instance.id,
          workflowName: definition.name,
          stepName: step.name,
          previousStatus: 'compensating',
          newStatus: 'failed',
          error: stepResult.error,
          timestamp: new Date().toISOString(),
        });
      }
    }

    this.updateStatus(instance, 'compensated');

    this.emitEvent({
      type: 'workflow.compensated',
      instanceId: instance.id,
      workflowName: definition.name,
      previousStatus: 'compensating',
      newStatus: 'compensated',
      timestamp: new Date().toISOString(),
    });
  }

  private async executeStepWithTimeout(
    executor: (context: Record<string, unknown>) => Promise<unknown>,
    context: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<unknown> {
    if (timeoutMs <= 0) {
      return executor(context);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`단계 타임아웃: ${timeoutMs}ms 초과`));
      }, timeoutMs);

      executor(context)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private updateStatus(
    instance: WorkflowInstance,
    status: WorkflowStatus,
  ): void {
    instance.status = status;
    instance.updatedAt = new Date().toISOString();
  }

  private getActiveCount(): number {
    let count = 0;
    for (const inst of this.instances.values()) {
      if (inst.status === 'running' || inst.status === 'compensating') {
        count++;
      }
    }
    return count;
  }

  private pruneInstances(): void {
    if (this.instances.size <= this.maxRetainedInstances) return;

    // 완료된 오래된 인스턴스부터 제거
    const sorted = Array.from(this.instances.entries())
      .filter(([, inst]) => inst.status !== 'running' && inst.status !== 'compensating')
      .sort(([, a], [, b]) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const toRemove = this.instances.size - this.maxRetainedInstances;
    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      this.instances.delete(sorted[i]![0]);
    }
  }

  private emitEvent(event: WorkflowEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // 리스너 오류 무시 (엔진 안정성 보장)
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
