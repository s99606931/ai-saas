// Plan SC: SVC-AI-ADV-R638
// Design Ref: §CAREER_MATCH — 흥미/적성/학력 기반 직업 매칭 점수

type DataGrade = 'O' | 'C' | 'S'
type Interest = 'tech' | 'art' | 'social' | 'science' | 'business' | 'education'

interface Career {
  careerId: string
  name: string
  requiredEducation: 'highschool' | 'associate' | 'bachelor' | 'graduate'
  interests: Interest[]
  aptitudeSkills: string[]
  growthOutlook: number
}

interface YouthProfile {
  profileId: string
  age: number
  currentEducation: 'highschool' | 'associate' | 'bachelor' | 'graduate'
  interests: Interest[]
  skills: string[]
}

interface CareerRecommendation {
  profileId: string
  recommendations: Array<{ careerId: string; score: number; reason: string }>
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

const EDU_LEVEL: Record<Career['requiredEducation'], number> = {
  highschool: 1,
  associate: 2,
  bachelor: 3,
  graduate: 4,
}

export class YouthCareerGuidanceAI {
  private careers = new Map<string, Career>()
  private auditLog: AuditEntry[] = []

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerCareer(career: Career): Career {
    this.careers.set(career.careerId, career)
    this.log('career.register', `careerId=${career.careerId}`)
    return career
  }

  recommend(profile: YouthProfile, grade: DataGrade = 'O'): CareerRecommendation {
    blockClassifiedData(grade)
    const userLevel = EDU_LEVEL[profile.currentEducation]
    const recs: CareerRecommendation['recommendations'] = []

    for (const career of this.careers.values()) {
      const reqLevel = EDU_LEVEL[career.requiredEducation]
      if (reqLevel > userLevel) continue

      const interestOverlap = profile.interests.filter((i) => career.interests.includes(i)).length
      const skillOverlap = profile.skills.filter((s) => career.aptitudeSkills.includes(s)).length
      if (interestOverlap === 0 && skillOverlap === 0) continue

      const interestScore = profile.interests.length > 0 ? (interestOverlap / profile.interests.length) * 40 : 0
      const skillScore = career.aptitudeSkills.length > 0 ? (skillOverlap / career.aptitudeSkills.length) * 40 : 0
      const outlookScore = career.growthOutlook * 0.2
      const score = Math.round(interestScore + skillScore + outlookScore)

      recs.push({
        careerId: career.careerId,
        score,
        reason: `흥미 ${interestOverlap}개 / 스킬 ${skillOverlap}개 일치`,
      })
    }

    recs.sort((a, b) => b.score - a.score)
    this.log('career.recommend', `profileId=${profile.profileId} count=${recs.length}`)
    return { profileId: profile.profileId, recommendations: recs }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
