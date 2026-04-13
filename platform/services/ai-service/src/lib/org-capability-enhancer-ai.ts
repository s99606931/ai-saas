// Design Ref: §R434 — AI기반 공공기관 조직 역량 강화 분석
// Plan SC: SVC-AI-ADV-R434-SC01

export type SkillDomain = 'DIGITAL' | 'MANAGEMENT' | 'SECURITY' | 'DATA' | 'COMMUNICATION' | 'LEGAL'
export type CapabilityLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'
export type DataGrade = 'C' | 'S' | 'O'

export interface StaffProfile {
  staffId: string
  departmentId: string
  grade: DataGrade
  skills: Array<{ domain: SkillDomain; level: CapabilityLevel; lastUpdated: string }>
}

export interface TrainingRecommendation {
  domain: SkillDomain
  currentLevel: CapabilityLevel
  targetLevel: CapabilityLevel
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  rationale: string
}

export interface CapabilityAssessment {
  departmentId: string
  staffCount: number
  domainScores: Record<SkillDomain, number>    // 0..100
  weakDomains: SkillDomain[]
  strongDomains: SkillDomain[]
  recommendations: TrainingRecommendation[]
  overallScore: number
}

interface AuditEntry {
  timestamp: string
  action: string
  departmentId: string
  detail: Record<string, unknown>
}

const LEVEL_SCORE: Record<CapabilityLevel, number> = {
  BEGINNER: 25, INTERMEDIATE: 50, ADVANCED: 75, EXPERT: 100,
}

const NEXT_LEVEL: Record<CapabilityLevel, CapabilityLevel> = {
  BEGINNER: 'INTERMEDIATE', INTERMEDIATE: 'ADVANCED', ADVANCED: 'EXPERT', EXPERT: 'EXPERT',
}

export class OrgCapabilityEnhancerAI {
  private profiles = new Map<string, StaffProfile[]>()  // departmentId → profiles
  private auditLog: AuditEntry[] = []

  registerStaff(profile: StaffProfile): void {
    // N2SF C/S 등급 차단
    if (profile.grade === 'C' || profile.grade === 'S') {
      throw new Error(`BLOCKED: ${profile.grade}등급 인사 데이터는 AI 역량 분석 금지 (N2SF N-05)`)
    }
    const list = this.profiles.get(profile.departmentId) ?? []
    list.push(profile)
    this.profiles.set(profile.departmentId, list)
    this.appendAudit('staff.register', profile.departmentId, { staffId: profile.staffId })
  }

  assess(departmentId: string): CapabilityAssessment {
    const profiles = this.profiles.get(departmentId) ?? []
    this.appendAudit('capability.assess', departmentId, { staffCount: profiles.length })

    const allDomains: SkillDomain[] = ['DIGITAL', 'MANAGEMENT', 'SECURITY', 'DATA', 'COMMUNICATION', 'LEGAL']
    const domainScores: Record<SkillDomain, number> = {
      DIGITAL: 0, MANAGEMENT: 0, SECURITY: 0, DATA: 0, COMMUNICATION: 0, LEGAL: 0,
    }

    if (profiles.length === 0) {
      return {
        departmentId, staffCount: 0, domainScores,
        weakDomains: allDomains, strongDomains: [], recommendations: [], overallScore: 0,
      }
    }

    // 도메인별 평균 점수 계산
    const domainTotals: Record<SkillDomain, { sum: number; count: number }> = {
      DIGITAL: { sum: 0, count: 0 }, MANAGEMENT: { sum: 0, count: 0 },
      SECURITY: { sum: 0, count: 0 }, DATA: { sum: 0, count: 0 },
      COMMUNICATION: { sum: 0, count: 0 }, LEGAL: { sum: 0, count: 0 },
    }

    for (const profile of profiles) {
      for (const skill of profile.skills) {
        domainTotals[skill.domain].sum += LEVEL_SCORE[skill.level]
        domainTotals[skill.domain].count++
      }
    }

    for (const domain of allDomains) {
      const { sum, count } = domainTotals[domain]
      domainScores[domain] = count > 0 ? Math.round(sum / count) : 0
    }

    const weakDomains = allDomains.filter((d) => domainScores[d] < 50)
    const strongDomains = allDomains.filter((d) => domainScores[d] >= 75)
    const overallScore = Math.round(allDomains.reduce((s, d) => s + domainScores[d], 0) / allDomains.length)

    // 취약 도메인 기반 교육 권고
    const recommendations: TrainingRecommendation[] = weakDomains.map((domain) => {
      const score = domainScores[domain]
      const currentLevel: CapabilityLevel = score >= 75 ? 'ADVANCED' : score >= 50 ? 'INTERMEDIATE' : 'BEGINNER'
      return {
        domain,
        currentLevel,
        targetLevel: NEXT_LEVEL[currentLevel],
        priority: score < 25 ? 'HIGH' : 'MEDIUM',
        rationale: `${domain} 역량 점수 ${score}점 — 교육 프로그램 우선 적용 권장`,
      }
    })

    return { departmentId, staffCount: profiles.length, domainScores, weakDomains, strongDomains, recommendations, overallScore }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, departmentId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, departmentId, detail })
  }
}
