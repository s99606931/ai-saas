// Design Ref: §클래스 설계 — PerformanceManagementAutomatorV2
// Plan SC: SVC-AI-ADV-R553

import { createHash } from 'crypto'

interface PerformanceGoal {
  goalId: string
  name: string
  targetScore: number
  period: string
}

interface AuditEntry { timestamp: string; action: string; goalId: string; maskedEvaluatorId?: string; details?: Record<string, unknown> }

export class PerformanceManagementAutomatorV2 {
  private goals = new Map<string, PerformanceGoal>()
  private scores = new Map<string, number[]>()
  private auditLog: AuditEntry[] = []

  registerGoal(goalId: string, name: string, targetScore: number, period: string): PerformanceGoal {
    const goal: PerformanceGoal = { goalId, name, targetScore, period }
    this.goals.set(goalId, goal)
    this.scores.set(goalId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_GOAL', goalId, details: { name, targetScore, period } })
    return goal
  }

  recordEvaluation(goalId: string, evaluatorId: string, score: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.goals.has(goalId)) throw new Error(`목표를 찾을 수 없습니다: ${goalId}`)
    this.scores.get(goalId)!.push(score)
    const maskedEvaluatorId = createHash('sha256').update(evaluatorId).digest('hex').substring(0, 16)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_EVALUATION', goalId, maskedEvaluatorId, details: { score } })
  }

  isAchieved(goalId: string): boolean {
    const goal = this.goals.get(goalId)
    if (!goal) throw new Error(`목표를 찾을 수 없습니다: ${goalId}`)
    const goalScores = this.scores.get(goalId) ?? []
    if (goalScores.length === 0) return false
    const avg = goalScores.reduce((s, v) => s + v, 0) / goalScores.length
    return avg >= goal.targetScore
  }

  getUnachievedGoals(): PerformanceGoal[] {
    return Array.from(this.goals.values()).filter(g => !this.isAchieved(g.goalId))
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
