// Design Ref: §R395 — AI기반 공공기관 업무 위험 평가
// Plan SC: SVC-AI-ADV-R395-SC01

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type DataGrade = 'C' | 'S' | 'O'

export interface PublicTask {
  taskId: string
  title: string
  department: string
  deadline: string  // ISO date
  budget: number    // 원(KRW)
  stakeholderCount: number
  involvesPII: boolean
  requiresExternal: boolean  // 외부 연계 필요 여부
  grade: DataGrade
}

export interface RiskAssessment {
  taskId: string
  riskLevel: RiskLevel
  riskScore: number  // 0..100
  riskFactors: string[]
  mitigations: string[]
  recommendedPriority: TaskPriority
}

interface AuditEntry {
  timestamp: string
  action: string
  taskId: string
  detail: Record<string, unknown>
}

export class PublicTaskRiskAssessorAI {
  private tasks = new Map<string, PublicTask>()
  private auditLog: AuditEntry[] = []

  registerTask(task: PublicTask): void {
    // N2SF C/S 등급 차단
    if (task.grade === 'C' || task.grade === 'S') {
      throw new Error(`BLOCKED: ${task.grade}등급 업무 데이터는 AI 위험 평가 금지 (N2SF N-05)`)
    }
    this.tasks.set(task.taskId, task)
    this.appendAudit('task.register', task.taskId, { department: task.department })
  }

  assess(taskId: string): RiskAssessment {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Unknown task: ${taskId}`)

    const riskFactors: string[] = []
    const mitigations: string[] = []
    let riskScore = 0

    // 마감 기한 촉박 검사 (7일 이내)
    const daysToDeadline = (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (daysToDeadline < 0) {
      riskScore += 30
      riskFactors.push('마감 기한 초과')
      mitigations.push('즉시 이해관계자에게 지연 보고 및 일정 재조정')
    } else if (daysToDeadline < 7) {
      riskScore += 20
      riskFactors.push(`마감 ${Math.floor(daysToDeadline)}일 남음 — 촉박`)
      mitigations.push('리소스 집중 투입 및 일정 모니터링 강화')
    }

    // 예산 규모 (5억 이상)
    if (task.budget >= 500_000_000) {
      riskScore += 20
      riskFactors.push(`대규모 예산 (${(task.budget / 100_000_000).toFixed(1)}억 원)`)
      mitigations.push('예산 집행 이력 주기적 검토 및 감사 준비')
    }

    // 이해관계자 다수 (10명 이상)
    if (task.stakeholderCount >= 10) {
      riskScore += 15
      riskFactors.push(`이해관계자 ${task.stakeholderCount}명 — 조정 복잡도 높음`)
      mitigations.push('정기 이해관계자 회의 및 소통 채널 구축')
    }

    // PII 포함
    if (task.involvesPII) {
      riskScore += 20
      riskFactors.push('개인정보(PII) 처리 포함')
      mitigations.push('개인정보 처리 방침 검토 및 CSAP D-09 암호화 적용 확인')
    }

    // 외부 연계
    if (task.requiresExternal) {
      riskScore += 15
      riskFactors.push('외부 시스템 연계 필요')
      mitigations.push('외부 기관 협력 프로토콜 사전 수립 및 SLA 확인')
    }

    riskScore = Math.min(100, riskScore)

    const riskLevel: RiskLevel =
      riskScore >= 70 ? 'CRITICAL'
        : riskScore >= 40 ? 'HIGH'
        : riskScore >= 20 ? 'MEDIUM'
        : 'LOW'

    const recommendedPriority: TaskPriority =
      riskLevel === 'CRITICAL' ? 'CRITICAL'
        : riskLevel === 'HIGH' ? 'HIGH'
        : riskLevel === 'MEDIUM' ? 'MEDIUM'
        : 'LOW'

    this.appendAudit('task.assess', taskId, { riskLevel, riskScore })

    return { taskId, riskLevel, riskScore, riskFactors, mitigations, recommendedPriority }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, taskId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, taskId, detail })
  }
}
