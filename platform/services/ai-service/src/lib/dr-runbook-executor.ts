// Design Ref: §R269 — 재해복구 런북 자동 실행 엔진
// Plan SC: SVC-AI-ADV-R269-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type StepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK'

export interface StepDefinition {
  stepId: string
  name: string
  dependsOn: string[]
}

export interface StepState {
  stepId: string
  status: StepStatus
  startedAt?: string
  finishedAt?: string
  retryCount: number
  errorMessage?: string
}

export interface Runbook {
  runbookId: string
  approver: string
  steps: StepDefinition[]
}

export interface RunbookStatus {
  runbookId: string
  total: number
  completed: number
  failed: number
  pending: number
  running: number
  rolledBack: number
  progressPct: number
  durationMs?: number
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

interface RunbookInternal {
  definition: Runbook
  states: Map<string, StepState>
  startedAt: string
  finishedAt?: string
}

export class DrRunbookExecutor {
  private runbooks = new Map<string, RunbookInternal>()
  private auditLog: AuditEntry[] = []

  registerRunbook(rb: Runbook, grade: DataGrade, caller: string): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 런북 등록 금지 (N2SF N-05)`)
    }
    if (!rb.runbookId) throw new Error('runbookId 필수')
    if (!rb.approver) throw new Error('approver 필수')
    if (rb.steps.length === 0) throw new Error('steps 최소 1개 필요')
    if (this.runbooks.has(rb.runbookId)) {
      throw new Error(`중복 runbookId: ${rb.runbookId}`)
    }

    // 의존성 검증
    const stepIds = new Set(rb.steps.map((s) => s.stepId))
    for (const step of rb.steps) {
      for (const dep of step.dependsOn) {
        if (!stepIds.has(dep)) {
          throw new Error(`잘못된 의존 단계: ${step.stepId} → ${dep}`)
        }
      }
    }

    const states = new Map<string, StepState>()
    for (const s of rb.steps) {
      states.set(s.stepId, { stepId: s.stepId, status: 'PENDING', retryCount: 0 })
    }

    this.runbooks.set(rb.runbookId, {
      definition: rb,
      states,
      startedAt: new Date().toISOString(),
    })

    this.appendAudit('runbook.register', this.mask(caller), {
      runbookId: rb.runbookId,
      approverMasked: this.mask(rb.approver),
      stepCount: rb.steps.length,
    })
  }

  executeStep(runbookId: string, stepId: string, success: boolean, errorMessage?: string): StepState {
    const rb = this.requireRunbook(runbookId)
    const state = rb.states.get(stepId)
    if (!state) throw new Error(`stepId 없음: ${stepId}`)
    if (state.status === 'COMPLETED') {
      throw new Error(`이미 완료된 단계: ${stepId}`)
    }

    // 의존성 검증
    const stepDef = rb.definition.steps.find((s) => s.stepId === stepId)
    if (!stepDef) throw new Error(`정의 없음: ${stepId}`)
    for (const dep of stepDef.dependsOn) {
      const depState = rb.states.get(dep)
      if (depState?.status !== 'COMPLETED') {
        throw new Error(`의존 단계 미완료: ${stepId} → ${dep}`)
      }
    }

    state.startedAt ??= new Date().toISOString()
    state.status = success ? 'COMPLETED' : 'FAILED'
    state.finishedAt = new Date().toISOString()
    if (!success) {
      state.retryCount++
      state.errorMessage = errorMessage ?? 'unknown'
    }

    // 모든 단계 완료 시 finishedAt 설정
    if (this.allCompleted(rb)) {
      rb.finishedAt = new Date().toISOString()
    }

    this.appendAudit('step.execute', 'SYSTEM', {
      runbookId,
      stepId,
      status: state.status,
    })
    return { ...state }
  }

  rollback(runbookId: string, stepId: string): StepState {
    const rb = this.requireRunbook(runbookId)
    const state = rb.states.get(stepId)
    if (!state) throw new Error(`stepId 없음: ${stepId}`)
    if (state.status !== 'FAILED' && state.status !== 'COMPLETED') {
      throw new Error(`롤백 불가 상태: ${state.status}`)
    }
    state.status = 'ROLLED_BACK'
    state.finishedAt = new Date().toISOString()
    this.appendAudit('step.rollback', 'SYSTEM', { runbookId, stepId })
    return { ...state }
  }

  getStatus(runbookId: string): RunbookStatus {
    const rb = this.requireRunbook(runbookId)
    const states = [...rb.states.values()]
    const total = states.length
    const completed = states.filter((s) => s.status === 'COMPLETED').length
    const failed = states.filter((s) => s.status === 'FAILED').length
    const pending = states.filter((s) => s.status === 'PENDING').length
    const running = states.filter((s) => s.status === 'RUNNING').length
    const rolledBack = states.filter((s) => s.status === 'ROLLED_BACK').length
    const progressPct = Math.round((completed / total) * 100)
    const durationMs = rb.finishedAt
      ? new Date(rb.finishedAt).getTime() - new Date(rb.startedAt).getTime()
      : undefined

    return {
      runbookId,
      total,
      completed,
      failed,
      pending,
      running,
      rolledBack,
      progressPct,
      ...(durationMs !== undefined ? { durationMs } : {}),
    }
  }

  listRunbooks(): string[] {
    return [...this.runbooks.keys()]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private requireRunbook(runbookId: string): RunbookInternal {
    const rb = this.runbooks.get(runbookId)
    if (!rb) throw new Error(`runbookId 없음: ${runbookId}`)
    return rb
  }

  private allCompleted(rb: RunbookInternal): boolean {
    for (const state of rb.states.values()) {
      if (state.status !== 'COMPLETED') return false
    }
    return true
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(
    action: string,
    callerMasked: string,
    detail: Record<string, unknown>
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
