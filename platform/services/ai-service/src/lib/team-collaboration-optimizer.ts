// Design Ref: §R250 — 팀 협업 워크플로우 최적화기
// Plan SC: SVC-AI-ADV-R250-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type BottleneckSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface MemberProfile {
  memberId: string
  name: string
  role: string
  skills: string[]
  weeklyCapacityHours: number
  grade?: DataGrade
}

export interface TaskItem {
  taskId: string
  title: string
  priority: TaskPriority
  requiredSkills: string[]
  estimatedHours: number
  dueDate: string
  assignedTo?: string
}

export interface WorkloadReport {
  memberId: string
  name: string
  allocatedHours: number
  capacityHours: number
  loadRatio: number
  status: 'UNDERUTILIZED' | 'BALANCED' | 'OVERLOADED'
}

export interface AssignmentRecommendation {
  taskId: string
  memberId: string
  name: string
  score: number
  skillMatch: number
  loadAfter: number
  reason: string
}

export interface Bottleneck {
  memberId: string
  severity: BottleneckSeverity
  cause: 'OVERLOAD' | 'SKILL_GAP' | 'DEADLINE_RISK'
  detail: string
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class TeamCollaborationOptimizer {
  private members = new Map<string, MemberProfile>()
  private tasks = new Map<string, TaskItem>()
  private auditLog: AuditEntry[] = []

  registerMember(profile: MemberProfile): void {
    if (profile.grade === 'C' || profile.grade === 'S') {
      throw new Error(`BLOCKED: ${profile.grade}등급 팀원 데이터는 AI 분석 금지 (N2SF N-05)`)
    }
    if (profile.weeklyCapacityHours <= 0) {
      throw new Error('weeklyCapacityHours는 양수여야 합니다')
    }
    this.members.set(profile.memberId, profile)
    this.appendAudit('member.register', { memberId: profile.memberId, role: profile.role })
  }

  registerTask(task: TaskItem): void {
    if (task.estimatedHours <= 0) {
      throw new Error('estimatedHours는 양수여야 합니다')
    }
    this.tasks.set(task.taskId, task)
    this.appendAudit('task.register', { taskId: task.taskId, priority: task.priority })
  }

  assignTask(taskId: string, memberId: string): void {
    const task = this.tasks.get(taskId)
    const member = this.members.get(memberId)
    if (!task) throw new Error(`Unknown task: ${taskId}`)
    if (!member) throw new Error(`Unknown member: ${memberId}`)
    task.assignedTo = memberId
    this.appendAudit('task.assign', { taskId, memberId })
  }

  analyzeWorkload(): WorkloadReport[] {
    const reports: WorkloadReport[] = []
    for (const member of this.members.values()) {
      const allocated = Array.from(this.tasks.values())
        .filter((t) => t.assignedTo === member.memberId)
        .reduce((sum, t) => sum + t.estimatedHours, 0)
      const ratio = allocated / member.weeklyCapacityHours
      let status: WorkloadReport['status'] = 'BALANCED'
      if (ratio < 0.5) status = 'UNDERUTILIZED'
      else if (ratio > 1.0) status = 'OVERLOADED'
      reports.push({
        memberId: member.memberId,
        name: member.name,
        allocatedHours: allocated,
        capacityHours: member.weeklyCapacityHours,
        loadRatio: Math.round(ratio * 100) / 100,
        status,
      })
    }
    this.appendAudit('workload.analyze', { count: reports.length })
    return reports
  }

  recommendAssignment(taskId: string): AssignmentRecommendation[] {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Unknown task: ${taskId}`)

    const candidates: AssignmentRecommendation[] = []
    for (const member of this.members.values()) {
      const matchCount = task.requiredSkills.filter((s) => member.skills.includes(s)).length
      const skillMatch =
        task.requiredSkills.length === 0 ? 100 : (matchCount / task.requiredSkills.length) * 100
      const currentAllocated = Array.from(this.tasks.values())
        .filter((t) => t.assignedTo === member.memberId)
        .reduce((sum, t) => sum + t.estimatedHours, 0)
      const loadAfter = (currentAllocated + task.estimatedHours) / member.weeklyCapacityHours
      const loadScore = Math.max(0, 1 - loadAfter) * 100
      const score = Math.round(skillMatch * 0.6 + loadScore * 0.4)
      const reason =
        matchCount === task.requiredSkills.length
          ? '모든 스킬 보유'
          : matchCount > 0
            ? `${matchCount}/${task.requiredSkills.length} 스킬 매칭`
            : '스킬 불일치'
      candidates.push({
        taskId,
        memberId: member.memberId,
        name: member.name,
        score,
        skillMatch: Math.round(skillMatch),
        loadAfter: Math.round(loadAfter * 100) / 100,
        reason,
      })
    }
    candidates.sort((a, b) => b.score - a.score)
    this.appendAudit('assignment.recommend', { taskId, candidates: candidates.length })
    return candidates
  }

  detectBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = []
    const workload = this.analyzeWorkload()
    for (const report of workload) {
      if (report.loadRatio > 1.2) {
        bottlenecks.push({
          memberId: report.memberId,
          severity: 'CRITICAL',
          cause: 'OVERLOAD',
          detail: `부하율 ${report.loadRatio} (가용 시간 ${Math.round((report.loadRatio - 1) * 100)}% 초과)`,
        })
      } else if (report.loadRatio > 1.0) {
        bottlenecks.push({
          memberId: report.memberId,
          severity: 'HIGH',
          cause: 'OVERLOAD',
          detail: `부하율 ${report.loadRatio}`,
        })
      }
    }

    const now = Date.now()
    for (const task of this.tasks.values()) {
      if (!task.assignedTo) continue
      const dueMs = new Date(task.dueDate).getTime()
      const daysLeft = (dueMs - now) / 86400000
      if (daysLeft < 3 && task.priority === 'CRITICAL') {
        bottlenecks.push({
          memberId: task.assignedTo,
          severity: 'HIGH',
          cause: 'DEADLINE_RISK',
          detail: `CRITICAL 태스크 ${task.taskId} 마감 임박 (${Math.max(0, Math.round(daysLeft))}일)`,
        })
      }
    }

    this.appendAudit('bottleneck.detect', { count: bottlenecks.length })
    return bottlenecks
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      detail,
    })
  }
}
