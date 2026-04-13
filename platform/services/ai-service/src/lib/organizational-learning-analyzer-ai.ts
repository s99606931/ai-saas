// Design Ref: §핵심 알고리즘 — 학습 효율 계산, PII 마스킹
// Plan SC: SVC-AI-ADV-R341
import { createHash } from 'node:crypto'

export type DataGrade = 'O' | 'C' | 'S'

export interface LearningRecord {
  courseId: string
  score: number
  completed: boolean
}

export interface LearningStats {
  maskedMemberId: string
  completionRate: number
  avgScore: number
  efficiency: number
  totalCourses: number
}

export interface DepartmentStats {
  department: string
  memberCount: number
  avgEfficiency: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskId(id: string): string {
  return createHash('sha256').update(id).digest('hex').substring(0, 16)
}

export class OrganizationalLearningAnalyzerAI {
  private members = new Map<string, string>()
  private learningData = new Map<string, LearningRecord[]>()
  private auditLog: AuditEntry[] = []

  registerMember(id: string, department: string): void {
    if (!id || !department) throw new Error('id와 department는 필수')
    this.members.set(id, department)
    this.learningData.set(id, [])
    this.auditLog.push({ action: 'member.register', timestamp: new Date().toISOString(), detail: maskId(id) })
  }

  recordLearning(memberId: string, courseId: string, score: number, completed: boolean, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 인사 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.members.has(memberId)) throw new Error(`memberId 없음: ${memberId}`)
    this.learningData.get(memberId)!.push({ courseId, score, completed })
    this.auditLog.push({ action: 'learning.record', timestamp: new Date().toISOString(), detail: `${maskId(memberId)}:${courseId}` })
  }

  getMemberStats(memberId: string): LearningStats {
    if (!this.members.has(memberId)) throw new Error(`memberId 없음: ${memberId}`)
    const records = this.learningData.get(memberId) ?? []
    const total = records.length
    const completed = records.filter((r) => r.completed)
    const completionRate = total === 0 ? 0 : Math.round((completed.length / total) * 10000) / 100
    const avgScore = completed.length === 0 ? 0 : Math.round(completed.reduce((s, r) => s + r.score, 0) / completed.length * 100) / 100
    const efficiency = Math.round(completionRate * avgScore) / 100
    return { maskedMemberId: maskId(memberId), completionRate, avgScore, efficiency, totalCourses: total }
  }

  getDepartmentStats(department: string): DepartmentStats {
    const members = [...this.members.entries()].filter(([, dept]) => dept === department).map(([id]) => id)
    if (members.length === 0) return { department, memberCount: 0, avgEfficiency: 0 }
    const efficiencies = members.map((id) => this.getMemberStats(id).efficiency)
    const avgEfficiency = Math.round(efficiencies.reduce((s, e) => s + e, 0) / efficiencies.length * 100) / 100
    return { department, memberCount: members.length, avgEfficiency }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
