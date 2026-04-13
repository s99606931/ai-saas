// Design Ref: §R508 — 학교 성과 분석 AI
// Plan SC: SVC-AI-ADV-R508-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type PerformanceTier = 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'NEEDS_IMPROVEMENT'

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export interface SchoolMetrics {
  schoolId: string
  region: string
  enrolledStudents: number
  graduationRatePct: number
  attendanceRatePct: number
  avgTestScore: number
  teacherStudentRatio: number
}

export interface PerformanceReport {
  schoolId: string
  tier: PerformanceTier
  compositeScore: number
  strengths: string[]
  improvements: string[]
  percentile: number
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class SchoolPerformanceAnalyticsAi {
  private readonly schools = new Map<string, SchoolMetrics>()
  private readonly auditLog: AuditEntry[] = []

  registerSchool(metrics: SchoolMetrics, grade: DataGrade): void {
    blockClassifiedData(grade)
    if (!metrics.schoolId) throw new Error('schoolId 필수')
    if (metrics.enrolledStudents <= 0) throw new Error('enrolledStudents는 양수')
    if (metrics.graduationRatePct < 0 || metrics.graduationRatePct > 100) {
      throw new Error('graduationRatePct는 0~100')
    }
    if (this.schools.has(metrics.schoolId)) {
      throw new Error(`중복 schoolId: ${metrics.schoolId}`)
    }
    this.schools.set(metrics.schoolId, { ...metrics })
    this.appendAudit('school.register', { schoolId: metrics.schoolId })
  }

  analyze(schoolId: string): PerformanceReport {
    const m = this.schools.get(schoolId)
    if (!m) throw new Error(`schoolId 없음: ${schoolId}`)
    const score = this.computeCompositeScore(m)
    const tier = this.scoreToTier(score)
    const strengths: string[] = []
    const improvements: string[] = []

    if (m.graduationRatePct >= 95) strengths.push('우수한 졸업률')
    else if (m.graduationRatePct < 80) improvements.push('졸업률 개선 필요')

    if (m.attendanceRatePct >= 95) strengths.push('높은 출석률')
    else if (m.attendanceRatePct < 85) improvements.push('출석률 관리 강화')

    if (m.avgTestScore >= 85) strengths.push('학업 성취도 우수')
    else if (m.avgTestScore < 70) improvements.push('학업 보조 프로그램 도입')

    if (m.teacherStudentRatio <= 15) strengths.push('적정 교사 비율')
    else if (m.teacherStudentRatio > 25) improvements.push('교사 충원 필요')

    const percentile = this.computePercentile(schoolId, score)

    this.appendAudit('school.analyze', { schoolId, tier, score })

    return { schoolId, tier, compositeScore: score, strengths, improvements, percentile }
  }

  listSchools(): string[] {
    return [...this.schools.keys()]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private computeCompositeScore(m: SchoolMetrics): number {
    const grad = m.graduationRatePct * 0.3
    const att = m.attendanceRatePct * 0.25
    const test = m.avgTestScore * 0.35
    const ratio = Math.max(0, (30 - m.teacherStudentRatio) / 30) * 100 * 0.1
    return Math.round((grad + att + test + ratio) * 10) / 10
  }

  private scoreToTier(score: number): PerformanceTier {
    if (score >= 90) return 'EXCELLENT'
    if (score >= 80) return 'GOOD'
    if (score >= 65) return 'AVERAGE'
    return 'NEEDS_IMPROVEMENT'
  }

  private computePercentile(schoolId: string, score: number): number {
    const allScores = [...this.schools.keys()]
      .filter((id) => id !== schoolId)
      .map((id) => this.computeCompositeScore(this.schools.get(id)!))
    if (allScores.length === 0) return 50
    const below = allScores.filter((s) => s < score).length
    return Math.round((below / allScores.length) * 100)
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
