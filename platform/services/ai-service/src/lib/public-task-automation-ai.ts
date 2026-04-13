// Design Ref: §R352 — AI기반 공공기관 업무 자동화
// Plan SC: SC-R352

export interface AutomationTask {
  taskId: string
  taskName: string
  department: string
  triggerType: 'SCHEDULE' | 'EVENT' | 'MANUAL'
  steps: AutomationStep[]
  dataGrade: 'C' | 'S' | 'O'
}

export interface AutomationStep {
  stepId: string
  action: string
  inputFields: string[]
  requiresApproval: boolean
}

export interface TaskExecutionRequest {
  taskId: string
  triggeredBy: string
  inputData: Record<string, string>
}

export type ExecutionStatus = 'COMPLETED' | 'PENDING_APPROVAL' | 'BLOCKED_DATA_GRADE' | 'FAILED'

export interface TaskExecutionResult {
  taskId: string
  maskedTriggeredBy: string
  status: ExecutionStatus
  completedSteps: number
  totalSteps: number
  blockedReason?: string
  auditTrail: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskUser(userId: string): string {
  if (userId.length <= 3) return '*'.repeat(userId.length)
  return userId.slice(0, 2) + '*'.repeat(userId.length - 4) + userId.slice(-2)
}

export class PublicTaskAutomationAi {
  private tasks = new Map<string, AutomationTask>()
  private auditLog: AuditEntry[] = []

  registerTask(task: AutomationTask): void {
    // N2SF: C/S 등급 자동화 차단
    if (task.dataGrade === 'C' || task.dataGrade === 'S') {
      throw new Error(`BLOCKED: ${task.dataGrade}등급 데이터 자동화 차단 (N2SF N-05)`)
    }
    this.tasks.set(task.taskId, task)
    this.auditLog.push({ action: 'task.register', timestamp: new Date().toISOString(), detail: task.taskId })
  }

  execute(request: TaskExecutionRequest): TaskExecutionResult {
    const task = this.tasks.get(request.taskId)
    if (!task) throw new Error(`Task not found: ${request.taskId}`)

    const auditTrail: string[] = []
    let completedSteps = 0
    let status: ExecutionStatus = 'COMPLETED'
    let blockedReason: string | undefined

    for (const step of task.steps) {
      if (step.requiresApproval) {
        status = 'PENDING_APPROVAL'
        blockedReason = `step ${step.stepId} 승인 대기`
        auditTrail.push(`[PENDING] ${step.action} — 승인 필요`)
        break
      }
      completedSteps++
      auditTrail.push(`[OK] ${step.action}`)
    }

    if (status === 'COMPLETED') completedSteps = task.steps.length

    this.auditLog.push({ action: 'task.execute', timestamp: new Date().toISOString(), detail: `${request.taskId}:${status}` })
    return {
      taskId: request.taskId,
      maskedTriggeredBy: maskUser(request.triggeredBy),
      status,
      completedSteps,
      totalSteps: task.steps.length,
      blockedReason,
      auditTrail,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
