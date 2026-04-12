// 분산 트랜잭션 Saga 오케스트레이터
// Design Ref: docs/02-design/mtus/SVC-SAGA-R44.design.md §상태머신
// Plan SC: FR-SAGA.1~FR-SAGA.10
// CSAP: D-06 감사 훅, D-12 입력 검증, D-14 타임아웃

export type SagaStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'compensating'
  | 'compensated'
  | 'failed_compensation';

export interface SagaStep<TContext> {
  /** 단계 이름 (Saga 내 고유) */
  name: string;
  /** 정방향 실행 핸들러 */
  execute: (ctx: TContext) => Promise<void>;
  /** 보상 핸들러 (선택: 없으면 스킵) */
  compensate?: (ctx: TContext) => Promise<void>;
  /** 단계별 타임아웃 (ms). 0 또는 미지정 시 무제한. */
  timeoutMs?: number;
}

export interface SagaDefinition<TContext> {
  id: string;
  steps: SagaStep<TContext>[];
}

export interface SagaState<TContext> {
  sagaId: string;
  status: SagaStatus;
  currentStep: number;
  completedSteps: string[];
  compensatedSteps: string[];
  error?: string;
  compensationError?: string;
  context: TContext;
  startedAt: number;
  updatedAt: number;
}

export type SagaTransitionType =
  | 'start'
  | 'step_ok'
  | 'step_fail'
  | 'compensate_ok'
  | 'compensate_fail'
  | 'end';

export interface SagaTransitionEvent {
  type: SagaTransitionType;
  sagaId: string;
  step?: string;
  status: SagaStatus;
  error?: string;
  timestamp: number;
}

export interface SagaStore<TContext> {
  save(state: SagaState<TContext>): Promise<void>;
  load(sagaId: string): Promise<SagaState<TContext> | undefined>;
}

export interface SagaOptions<TContext> {
  store?: SagaStore<TContext>;
  onTransition?: (event: SagaTransitionEvent) => void;
}

export interface SagaCompensationFailure {
  step: string;
  error: string;
}

/**
 * Saga 실행 중 발생한 에러를 원본 에러 + 보상 실패와 함께 집계
 * Plan SC: FR-SAGA.10
 */
export class SagaExecutionError extends Error {
  public readonly cause: Error;
  public readonly compensationFailures: SagaCompensationFailure[];
  public readonly status: SagaStatus;

  constructor(
    message: string,
    cause: Error,
    status: SagaStatus,
    compensationFailures: SagaCompensationFailure[],
  ) {
    super(message);
    this.name = 'SagaExecutionError';
    this.cause = cause;
    this.status = status;
    this.compensationFailures = compensationFailures;
  }
}

/**
 * 메모리 기반 Saga 상태 저장소
 * Plan SC: FR-SAGA.9
 */
export class MemorySagaStore<TContext> implements SagaStore<TContext> {
  private readonly states = new Map<string, SagaState<TContext>>();

  async save(state: SagaState<TContext>): Promise<void> {
    this.states.set(state.sagaId, { ...state });
  }

  async load(sagaId: string): Promise<SagaState<TContext> | undefined> {
    const state = this.states.get(sagaId);
    return state ? { ...state } : undefined;
  }

  size(): number {
    return this.states.size;
  }
}

/**
 * Saga 오케스트레이터
 *
 * Plan SC: FR-SAGA.1~FR-SAGA.10
 * Design Ref: §핵심 알고리즘
 */
export class Saga<TContext> {
  private readonly store: SagaStore<TContext>;
  private readonly onTransition?: (event: SagaTransitionEvent) => void;

  constructor(options: SagaOptions<TContext> = {}) {
    this.store = options.store ?? new MemorySagaStore<TContext>();
    this.onTransition = options.onTransition;
  }

  /**
   * Saga 실행
   * Plan SC: FR-SAGA.1, FR-SAGA.2, FR-SAGA.8
   */
  async execute(
    definition: SagaDefinition<TContext>,
    initialContext: TContext,
  ): Promise<SagaState<TContext>> {
    this.validateDefinition(definition);

    const existing = await this.store.load(definition.id);
    if (
      existing &&
      (existing.status === 'running' || existing.status === 'compensating')
    ) {
      throw new Error(
        `Saga '${definition.id}' is already in progress (status=${existing.status}).`,
      );
    }

    const state: SagaState<TContext> = {
      sagaId: definition.id,
      status: 'pending',
      currentStep: -1,
      completedSteps: [],
      compensatedSteps: [],
      context: initialContext,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.emit({ type: 'start', sagaId: state.sagaId, status: 'pending' });
    state.status = 'running';
    await this.persist(state);

    for (let i = 0; i < definition.steps.length; i += 1) {
      const step = definition.steps[i]!;
      state.currentStep = i;
      state.updatedAt = Date.now();

      try {
        await this.runWithTimeout(
          () => step.execute(state.context),
          step.timeoutMs,
          step.name,
        );
        state.completedSteps.push(step.name);
        await this.persist(state);
        this.emit({
          type: 'step_ok',
          sagaId: state.sagaId,
          step: step.name,
          status: 'running',
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        state.error = error.message;
        state.updatedAt = Date.now();
        await this.persist(state);
        this.emit({
          type: 'step_fail',
          sagaId: state.sagaId,
          step: step.name,
          status: 'running',
          error: error.message,
        });

        const failures = await this.compensate(definition, state);

        this.emit({
          type: 'end',
          sagaId: state.sagaId,
          status: state.status,
          error: state.error,
        });

        throw new SagaExecutionError(
          `Saga '${definition.id}' failed at step '${step.name}': ${error.message}`,
          error,
          state.status,
          failures,
        );
      }
    }

    state.status = 'completed';
    state.updatedAt = Date.now();
    await this.persist(state);
    this.emit({
      type: 'end',
      sagaId: state.sagaId,
      status: 'completed',
    });

    return { ...state };
  }

  /**
   * 실패한 Saga의 상태 조회
   */
  async getState(
    sagaId: string,
  ): Promise<SagaState<TContext> | undefined> {
    return this.store.load(sagaId);
  }

  /**
   * 보상 단계 실행 (역순 LIFO)
   * Plan SC: FR-SAGA.3, FR-SAGA.4, FR-SAGA.10
   */
  private async compensate(
    definition: SagaDefinition<TContext>,
    state: SagaState<TContext>,
  ): Promise<SagaCompensationFailure[]> {
    state.status = 'compensating';
    state.updatedAt = Date.now();
    await this.persist(state);

    const failures: SagaCompensationFailure[] = [];
    const reversed = [...state.completedSteps].reverse();

    for (const stepName of reversed) {
      const step = definition.steps.find((s) => s.name === stepName);
      if (!step || !step.compensate) {
        continue;
      }

      try {
        await this.runWithTimeout(
          () => step.compensate!(state.context),
          step.timeoutMs,
          `${stepName}.compensate`,
        );
        state.compensatedSteps.push(stepName);
        await this.persist(state);
        this.emit({
          type: 'compensate_ok',
          sagaId: state.sagaId,
          step: stepName,
          status: 'compensating',
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        failures.push({ step: stepName, error: error.message });
        this.emit({
          type: 'compensate_fail',
          sagaId: state.sagaId,
          step: stepName,
          status: 'compensating',
          error: error.message,
        });
      }
    }

    if (failures.length === 0) {
      state.status = 'compensated';
    } else {
      state.status = 'failed_compensation';
      state.compensationError = JSON.stringify(failures);
    }
    state.updatedAt = Date.now();
    await this.persist(state);

    return failures;
  }

  /**
   * 타임아웃 래퍼
   * Plan SC: FR-SAGA.7
   */
  private async runWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number | undefined,
    label: string,
  ): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) {
      return fn();
    }
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step '${label}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      fn().then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  /**
   * 정의 유효성 검증
   * CSAP: D-12 입력 검증
   */
  private validateDefinition(definition: SagaDefinition<TContext>): void {
    if (!definition.id) {
      throw new Error('Saga definition.id is required.');
    }
    if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
      throw new Error('Saga must have at least one step.');
    }
    const seen = new Set<string>();
    for (const step of definition.steps) {
      if (!step.name) {
        throw new Error('Saga step.name is required.');
      }
      if (seen.has(step.name)) {
        throw new Error(`Duplicate saga step name: '${step.name}'`);
      }
      seen.add(step.name);
      if (typeof step.execute !== 'function') {
        throw new Error(
          `Saga step '${step.name}' must define an execute function.`,
        );
      }
    }
  }

  private async persist(state: SagaState<TContext>): Promise<void> {
    await this.store.save({ ...state });
  }

  private emit(
    event: Omit<SagaTransitionEvent, 'timestamp'>,
  ): void {
    if (!this.onTransition) return;
    try {
      this.onTransition({ ...event, timestamp: Date.now() });
    } catch {
      // 훅 오류는 Saga 실행에 영향 없도록 삼킴 (감사 훅 격리)
    }
  }
}
