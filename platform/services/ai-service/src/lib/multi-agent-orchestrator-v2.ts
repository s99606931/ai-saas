// Design Ref: §R205 — AI기반 멀티에이전트 오케스트레이터 v2
// Plan SC: SVC-AI-ADV-R205-SC01

export type AgentStatus = 'IDLE' | 'RUNNING' | 'DONE' | 'FAILED'
export type DataGrade = 'C' | 'S' | 'O'

export interface AgentDefinition {
  agentId: string
  name: string
  capabilities: string[]
  maxConcurrent: number
}

export interface AgentTask {
  taskId: string
  agentId: string
  input: string
  grade?: DataGrade
  dependsOn?: string[]
}

export interface AgentTaskResult {
  taskId: string
  agentId: string
  status: AgentStatus
  output?: string
  startedAt: string
  completedAt?: string
  error?: string
}

interface AuditEntry {
  timestamp: string
  action: string
  taskId: string
  detail: Record<string, unknown>
}

export class MultiAgentOrchestratorV2 {
  private agents = new Map<string, AgentDefinition>()
  private results = new Map<string, AgentTaskResult>()
  private auditLog: AuditEntry[] = []

  registerAgent(agent: AgentDefinition): void {
    this.agents.set(agent.agentId, agent)
    this.appendAudit('agent.register', agent.agentId, { name: agent.name })
  }

  submit(task: AgentTask): AgentTaskResult {
    // N2SF: C/S 등급 데이터 처리 차단
    if (task.grade === 'C' || task.grade === 'S') {
      throw new Error(`BLOCKED: ${task.grade}등급 데이터는 AI 에이전트 처리 금지 (N2SF N-05)`)
    }

    if (!this.agents.has(task.agentId)) throw new Error(`Unknown agent: ${task.agentId}`)

    // 의존성 검사
    if (task.dependsOn && task.dependsOn.length > 0) {
      for (const depId of task.dependsOn) {
        const dep = this.results.get(depId)
        if (!dep || dep.status !== 'DONE') {
          throw new Error(`Dependency not satisfied: ${depId}`)
        }
      }
    }

    const result: AgentTaskResult = {
      taskId: task.taskId,
      agentId: task.agentId,
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
    }
    this.results.set(task.taskId, result)
    this.appendAudit('task.submit', task.taskId, { agentId: task.agentId })

    // 동기 모의 실행 (테스트 가능성)
    result.output = `[${task.agentId}] processed: ${task.input}`
    result.status = 'DONE'
    result.completedAt = new Date().toISOString()
    this.results.set(task.taskId, result)
    this.appendAudit('task.complete', task.taskId, { status: 'DONE' })

    return { ...result }
  }

  getResult(taskId: string): AgentTaskResult {
    const result = this.results.get(taskId)
    if (!result) throw new Error(`Unknown task: ${taskId}`)
    return { ...result }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, taskId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, taskId, detail })
  }
}
