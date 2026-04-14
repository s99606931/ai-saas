// Design Ref: §R587 — AI기반 공공기관 표준 운영 절차 자동화
// Plan SC: SVC-AI-ADV-R587-SC01

export type StepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'SKIPPED' | 'FAILED'
export type SopStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT'

export interface SopStep {
  stepId: string
  name: string
  description: string
  executor: string      // 실행 주체 (SYSTEM | MANUAL | AUTO)
  required: boolean
  conditionField?: string   // context에서 확인할 조건 필드
  conditionValue?: unknown  // 조건 충족값
  timeoutMs?: number
}

export interface SopDefinition {
  sopId: string
  name: string
  category: string
  status: SopStatus
  steps: SopStep[]
  version: string
}

export interface StepExecution {
  stepId: string
  stepName: string
  status: StepStatus
  startedAt: string
  completedAt: string | null
  output: string
  error: string | null
}

export interface SopExecution {
  executionId: string
  sopId: string
  sopName: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  steps: StepExecution[]
  startedAt: string
  completedAt: string | null
  context: Record<string, unknown>
}

interface AuditEntry {
  timestamp: string
  action: string
  sopId: string
  detail: Record<string, unknown>
}

export class SopAutomationAI {
  private sops = new Map<string, SopDefinition>()
  private executions: SopExecution[] = []
  private auditLog: AuditEntry[] = []

  registerSOP(sop: SopDefinition): void {
    this.sops.set(sop.sopId, sop)
    this.appendAudit('sop.register', sop.sopId, { name: sop.name, stepCount: sop.steps.length })
  }

  execute(sopId: string, context: Record<string, unknown>): SopExecution {
    const sop = this.sops.get(sopId)
    if (!sop) throw new Error(`Unknown SOP: ${sopId}`)
    if (sop.status !== 'ACTIVE') throw new Error(`SOP is not active: ${sopId}`)

    const executionId = `EXEC-${sopId}-${Date.now()}`
    const stepResults: StepExecution[] = []
    let sopFailed = false

    for (const step of sop.steps) {
      const startedAt = new Date().toISOString()

      // 조건 검사
      const conditionMet = step.conditionField === undefined
        || context[step.conditionField] === step.conditionValue

      if (!conditionMet) {
        stepResults.push({ stepId: step.stepId, stepName: step.name, status: 'SKIPPED', startedAt, completedAt: new Date().toISOString(), output: '조건 미충족으로 건너뜀', error: null })
        continue
      }

      // 자동 실행 시뮬레이션 — SYSTEM 실행자는 성공, MANUAL은 COMPLETED로 간주
      const completedAt = new Date().toISOString()
      stepResults.push({ stepId: step.stepId, stepName: step.name, status: 'COMPLETED', startedAt, completedAt, output: `${step.name} 완료`, error: null })
    }

    const hasFailure = stepResults.some((s) => s.status === 'FAILED' && sop.steps.find((st) => st.stepId === s.stepId)?.required)
    if (hasFailure) sopFailed = true

    const execution: SopExecution = {
      executionId,
      sopId,
      sopName: sop.name,
      status: sopFailed ? 'FAILED' : 'COMPLETED',
      steps: stepResults,
      startedAt: stepResults[0]?.startedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      context,
    }
    this.executions.push(execution)
    this.appendAudit('sop.execute', sopId, { executionId, status: execution.status, stepCount: stepResults.length })
    return execution
  }

  getExecutionLog(sopId: string): SopExecution[] {
    return this.executions.filter((e) => e.sopId === sopId)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, sopId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, sopId, detail })
  }
}
