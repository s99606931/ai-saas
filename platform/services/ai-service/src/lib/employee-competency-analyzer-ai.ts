// Design Ref: §R300 — AI기반 직원 역량 자동 분석
// Plan SC: SC-R300

export interface CompetencyDefinition {
  competencyId: string
  name: string
  category: 'TECHNICAL' | 'LEADERSHIP' | 'COMMUNICATION' | 'PROBLEM_SOLVING'
  requiredLevel: number
}

export interface EmployeeProfile {
  employeeId: string
  name: string
  department: string
  competencyScores: { competencyId: string; score: number }[]
}

export interface CompetencyGap {
  competencyId: string
  name: string
  category: CompetencyDefinition['category']
  currentScore: number
  requiredLevel: number
  gap: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface CompetencyAnalysis {
  employeeId: string
  overallScore: number
  gaps: CompetencyGap[]
  strengths: string[]
  developmentRecommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class EmployeeCompetencyAnalyzerAi {
  private competencies = new Map<string, CompetencyDefinition>()
  private employees = new Map<string, EmployeeProfile>()
  private auditLog: AuditEntry[] = []

  registerCompetency(competency: CompetencyDefinition): void {
    this.competencies.set(competency.competencyId, competency)
    this.auditLog.push({ action: 'competency.register', timestamp: new Date().toISOString(), detail: competency.competencyId })
  }

  registerEmployee(employee: EmployeeProfile): void {
    // PII 마스킹 — 감사 로그에 실명 기록 금지
    const maskedName = employee.name.length > 1 ? employee.name[0] + '*'.repeat(employee.name.length - 1) : '*'
    this.employees.set(employee.employeeId, employee)
    this.auditLog.push({ action: 'employee.register', timestamp: new Date().toISOString(), detail: `${employee.employeeId}(${maskedName})` })
  }

  analyze(employeeId: string): CompetencyAnalysis {
    const employee = this.employees.get(employeeId)
    if (!employee) throw new Error(`Employee not found: ${employeeId}`)

    const scoreMap = new Map(employee.competencyScores.map((s) => [s.competencyId, s.score]))
    const gaps: CompetencyGap[] = []
    const strengths: string[] = []
    let totalScore = 0
    let count = 0

    for (const competency of this.competencies.values()) {
      const currentScore = scoreMap.get(competency.competencyId) ?? 0
      const gap = competency.requiredLevel - currentScore
      totalScore += currentScore
      count++

      if (gap > 0) {
        const priority: CompetencyGap['priority'] = gap >= 2 ? 'HIGH' : gap >= 1 ? 'MEDIUM' : 'LOW'
        gaps.push({
          competencyId: competency.competencyId,
          name: competency.name,
          category: competency.category,
          currentScore,
          requiredLevel: competency.requiredLevel,
          gap,
          priority,
        })
      } else if (currentScore >= competency.requiredLevel + 1) {
        strengths.push(competency.name)
      }
    }

    gaps.sort((a, b) => (a.priority === 'HIGH' ? -1 : b.priority === 'HIGH' ? 1 : 0))

    const overallScore = count > 0 ? Math.round((totalScore / count) * 10) : 0
    const developmentRecommendations = gaps
      .filter((g) => g.priority === 'HIGH')
      .map((g) => `${g.name} 역량 강화 교육 필요 (현재 ${g.currentScore} → 목표 ${g.requiredLevel})`)

    this.auditLog.push({ action: 'competency.analyze', timestamp: new Date().toISOString(), detail: employeeId })
    return { employeeId, overallScore, gaps, strengths, developmentRecommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
