// Design Ref: §핵심 알고리즘 — 인사 데이터 익명화, 부서별 통계
// Plan SC: SVC-AI-ADV-R347
import { createHash } from 'node:crypto'

export type DataGrade = 'O' | 'C' | 'S'

export interface DepartmentHrStats {
  department: string
  headcount: number
  avgPerformance: number
}

export interface PerformerEntry {
  maskedEmployeeId: string
  department: string
  avgScore: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskEmployee(id: string): string {
  return createHash('sha256').update(id).digest('hex').substring(0, 16)
}

export class HrDataAnalyzerAI {
  private employees = new Map<string, string>()
  private performanceData = new Map<string, number[]>()
  private auditLog: AuditEntry[] = []

  registerEmployee(id: string, department: string, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 인사 데이터 등록 금지 (N2SF N-05)`)
    }
    if (!id || !department) throw new Error('id와 department는 필수')
    this.employees.set(id, department)
    this.performanceData.set(id, [])
    this.auditLog.push({ action: 'employee.register', timestamp: new Date().toISOString(), detail: maskEmployee(id) })
  }

  recordPerformance(employeeId: string, score: number, period: string, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 성과 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.employees.has(employeeId)) throw new Error(`employeeId 없음: ${employeeId}`)
    this.performanceData.get(employeeId)!.push(score)
    this.auditLog.push({ action: 'performance.record', timestamp: new Date().toISOString(), detail: `${maskEmployee(employeeId)}:${period}` })
  }

  getDepartmentStats(department: string): DepartmentHrStats {
    const members = [...this.employees.entries()].filter(([, dept]) => dept === department).map(([id]) => id)
    if (members.length === 0) return { department, headcount: 0, avgPerformance: 0 }
    const allScores = members.flatMap((id) => this.performanceData.get(id) ?? [])
    const avgPerformance = allScores.length === 0
      ? 0
      : Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length * 100) / 100
    return { department, headcount: members.length, avgPerformance }
  }

  getTopPerformers(topN: number): PerformerEntry[] {
    const performers: PerformerEntry[] = []
    for (const [id, dept] of this.employees) {
      const scores = this.performanceData.get(id) ?? []
      if (scores.length === 0) continue
      const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 100) / 100
      performers.push({ maskedEmployeeId: maskEmployee(id), department: dept, avgScore })
    }
    return performers.sort((a, b) => b.avgScore - a.avgScore).slice(0, topN)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
