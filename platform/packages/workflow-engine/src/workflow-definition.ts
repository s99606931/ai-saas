// 워크플로우 정의 타입 시스템
// Design Ref: SVC-WORKFLOW-R20 Plan
// Plan SC: FR-WF.1
// CSAP: D-06 침해사고 관리 (감사 추적)

/**
 * 워크플로우 단계 실행 함수
 *
 * @param context 워크플로우 공유 컨텍스트 (단계 간 데이터 전달)
 * @returns 다음 단계에 전달할 결과 (컨텍스트에 병합)
 */
export type StepExecutor<TContext = Record<string, unknown>> = (
  context: TContext,
) => Promise<Partial<TContext> | void>;

/**
 * 보상 트랜잭션 함수 (Saga 패턴)
 *
 * 후행 단계 실패 시 역순으로 호출되어 선행 단계의 부작용을 되돌립니다.
 */
export type CompensationHandler<TContext = Record<string, unknown>> = (
  context: TContext,
) => Promise<void>;

/**
 * 워크플로우 단계 정의
 */
export interface StepDefinition<TContext = Record<string, unknown>> {
  /** 단계 고유 이름 */
  name: string;
  /** 단계 실행 함수 */
  execute: StepExecutor<TContext>;
  /** 보상 트랜잭션 (선택) */
  compensate?: CompensationHandler<TContext>;
  /** 최대 재시도 횟수 (기본: 워크플로우 설정 따름) */
  maxRetries?: number;
  /** 단계 타임아웃 (밀리초, 0 = 무제한) */
  timeoutMs?: number;
  /** 재시도 기본 대기 시간 (밀리초) */
  retryDelayMs?: number;
}

/**
 * 워크플로우 정의
 */
export interface WorkflowDefinition<TContext = Record<string, unknown>> {
  /** 워크플로우 고유 이름 */
  name: string;
  /** 버전 */
  version: string;
  /** 설명 */
  description?: string;
  /** 단계 목록 (실행 순서) */
  steps: StepDefinition<TContext>[];
  /** 기본 최대 재시도 횟수 (기본: 3) */
  defaultMaxRetries?: number;
  /** 기본 단계 타임아웃 (밀리초, 기본: 30000) */
  defaultTimeoutMs?: number;
  /** 기본 재시도 대기 시간 (밀리초, 기본: 100) */
  defaultRetryDelayMs?: number;
}

/**
 * 워크플로우 인스턴스 상태
 */
export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'compensating'
  | 'compensated';

/**
 * 단계 실행 상태
 */
export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'compensating'
  | 'compensated';

/**
 * 단계 실행 결과
 */
export interface StepResult {
  /** 단계 이름 */
  name: string;
  /** 실행 상태 */
  status: StepStatus;
  /** 시작 시각 */
  startedAt: string | null;
  /** 완료 시각 */
  completedAt: string | null;
  /** 시도 횟수 */
  attempts: number;
  /** 실패 사유 */
  error: string | null;
  /** 소요 시간 (밀리초) */
  durationMs: number | null;
}

/**
 * 워크플로우 인스턴스
 */
export interface WorkflowInstance<TContext = Record<string, unknown>> {
  /** 인스턴스 고유 ID */
  id: string;
  /** 워크플로우 이름 */
  workflowName: string;
  /** 워크플로우 버전 */
  workflowVersion: string;
  /** 현재 상태 */
  status: WorkflowStatus;
  /** 공유 컨텍스트 */
  context: TContext;
  /** 현재 단계 인덱스 */
  currentStepIndex: number;
  /** 단계별 결과 */
  stepResults: StepResult[];
  /** 생성 시각 */
  createdAt: string;
  /** 갱신 시각 */
  updatedAt: string;
  /** 완료 시각 */
  completedAt: string | null;
  /** 전체 소요 시간 (밀리초) */
  totalDurationMs: number | null;
}

/**
 * 워크플로우 정의 빌더 (편의 함수)
 *
 * @example
 * ```typescript
 * const workflow = defineWorkflow({
 *   name: 'user-onboarding',
 *   version: '1.0.0',
 *   steps: [
 *     {
 *       name: 'create-user',
 *       execute: async (ctx) => ({ userId: 'u-123' }),
 *       compensate: async (ctx) => { await deleteUser(ctx.userId); },
 *     },
 *     {
 *       name: 'create-tenant',
 *       execute: async (ctx) => ({ tenantId: 't-456' }),
 *       compensate: async (ctx) => { await deleteTenant(ctx.tenantId); },
 *     },
 *     {
 *       name: 'send-welcome-email',
 *       execute: async (ctx) => { await sendEmail(ctx.userId); },
 *     },
 *   ],
 * });
 * ```
 */
export function defineWorkflow<TContext = Record<string, unknown>>(
  definition: WorkflowDefinition<TContext>,
): WorkflowDefinition<TContext> {
  if (!definition.name) {
    throw new Error('워크플로우 이름은 필수입니다');
  }
  if (!definition.version) {
    throw new Error('워크플로우 버전은 필수입니다');
  }
  if (!definition.steps || definition.steps.length === 0) {
    throw new Error('워크플로우에 최소 1개 단계가 필요합니다');
  }

  // 단계 이름 중복 검사
  const names = new Set<string>();
  for (const step of definition.steps) {
    if (!step.name) {
      throw new Error('단계 이름은 필수입니다');
    }
    if (names.has(step.name)) {
      throw new Error(`단계 이름 중복: ${step.name}`);
    }
    names.add(step.name);
  }

  return {
    defaultMaxRetries: 3,
    defaultTimeoutMs: 30_000,
    defaultRetryDelayMs: 100,
    ...definition,
  };
}
