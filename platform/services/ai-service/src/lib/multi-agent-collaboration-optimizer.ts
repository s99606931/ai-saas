// Design Ref: §핵심 알고리즘 — 에이전트 부하율, 협업 효율 점수
// Plan SC: SVC-AI-ADV-R384
export type DataGrade = 'O' | 'C' | 'S'

export interface AgentEntry {
  id: string
  name: string
  maxCapacity: number
  completedTasks: number
  totalProcessingMs: number
}

export interface UtilizationResult {
  agentId: string
  name: string
  completedTasks: number
  maxCapacity: number
  utilizationRate: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class MultiAgentCollaborationOptimizer {
  private agents = new Map<string, AgentEntry>()
  private auditLog: AuditEntry[] = []

  registerAgent(id: string, name: string, maxCapacity: number): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    if (maxCapacity <= 0) throw new Error('maxCapacity는 양수여야 합니다')
    this.agents.set(id, { id, name, maxCapacity, completedTasks: 0, totalProcessingMs: 0 })
    this.auditLog.push({ action: 'agent.register', timestamp: new Date().toISOString(), detail: id })
  }

  assignTask(agentId: string, taskId: string, processingMs: number, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 에이전트 데이터 전송 금지 (N2SF N-05)`)
    }
    const agent = this.agents.get(agentId)
    if (!agent) throw new Error(`agentId 없음: ${agentId}`)
    agent.completedTasks += 1
    agent.totalProcessingMs += processingMs
    this.auditLog.push({ action: 'task.assign', timestamp: new Date().toISOString(), detail: `${agentId}:${taskId}` })
  }

  getAgentUtilization(agentId: string): UtilizationResult {
    const agent = this.agents.get(agentId)
    if (!agent) throw new Error(`agentId 없음: ${agentId}`)
    const utilizationRate = Math.round((agent.completedTasks / agent.maxCapacity) * 10000) / 100
    return { agentId, name: agent.name, completedTasks: agent.completedTasks, maxCapacity: agent.maxCapacity, utilizationRate }
  }

  getCollaborationEfficiency(): number {
    const agentList = [...this.agents.values()]
    if (agentList.length === 0) return 0
    const totalCompleted = agentList.reduce((s, a) => s + a.completedTasks, 0)
    const totalCapacity = agentList.reduce((s, a) => s + a.maxCapacity, 0)
    if (totalCapacity === 0) return 0
    return Math.round((totalCompleted / totalCapacity) * 10000) / 100
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
