// Design Ref: §R254 — 맞춤형 시민 서비스 추천 엔진
// Plan SC: SVC-AI-ADV-R254-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type EligibilityStatus = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'PARTIAL'

export interface ServiceCatalogItem {
  serviceId: string
  name: string
  category: string
  description: string
  minAge?: number
  maxAge?: number
  maxIncome?: number        // 월 소득 상한 (원)
  minHouseholdSize?: number
  regions?: string[]        // 해당 지역 (없으면 전국)
  urgencyScore: number      // 0~100, 긴급도
}

export interface CitizenProfile {
  citizenId: string
  age: number
  monthlyIncome: number
  householdSize: number
  region: string
  preferences: string[]     // 관심 카테고리
  grade?: DataGrade
}

export interface EligibilityResult {
  serviceId: string
  status: EligibilityStatus
  matchedCriteria: string[]
  failedCriteria: string[]
}

export interface Recommendation {
  serviceId: string
  name: string
  category: string
  priorityScore: number
  eligibility: EligibilityStatus
  reason: string
}

interface AuditEntry {
  timestamp: string
  action: string
  citizenIdMasked: string
  detail: Record<string, unknown>
}

export class CitizenServiceRecommender {
  private services = new Map<string, ServiceCatalogItem>()
  private citizens = new Map<string, CitizenProfile>()
  private auditLog: AuditEntry[] = []

  registerService(service: ServiceCatalogItem): void {
    this.services.set(service.serviceId, service)
    this.appendAudit('service.register', 'SYSTEM', { serviceId: service.serviceId })
  }

  registerCitizen(profile: CitizenProfile): void {
    if (profile.grade === 'C' || profile.grade === 'S') {
      throw new Error(`BLOCKED: ${profile.grade}등급 시민 데이터는 AI 추천 금지 (N2SF N-05)`)
    }
    if (profile.grade !== 'O') {
      throw new Error('시민 프로파일은 O등급만 허용됩니다 (PII 마스킹 전제)')
    }
    if (profile.age < 0 || profile.age > 150) {
      throw new Error('age는 0~150 범위여야 합니다')
    }
    this.citizens.set(profile.citizenId, profile)
    this.appendAudit('citizen.register', this.maskId(profile.citizenId), {
      ageRange: this.ageRange(profile.age),
      region: profile.region,
    })
  }

  checkEligibility(citizenId: string, serviceId: string): EligibilityResult {
    const citizen = this.citizens.get(citizenId)
    const service = this.services.get(serviceId)
    if (!citizen) throw new Error(`Unknown citizen: ${citizenId}`)
    if (!service) throw new Error(`Unknown service: ${serviceId}`)

    const matched: string[] = []
    const failed: string[] = []

    if (service.minAge !== undefined) {
      if (citizen.age >= service.minAge) matched.push(`최소 연령 ${service.minAge}`)
      else failed.push(`최소 연령 ${service.minAge} 미달`)
    }
    if (service.maxAge !== undefined) {
      if (citizen.age <= service.maxAge) matched.push(`최대 연령 ${service.maxAge}`)
      else failed.push(`최대 연령 ${service.maxAge} 초과`)
    }
    if (service.maxIncome !== undefined) {
      if (citizen.monthlyIncome <= service.maxIncome) matched.push(`소득 기준 충족`)
      else failed.push(`소득 상한 초과`)
    }
    if (service.minHouseholdSize !== undefined) {
      if (citizen.householdSize >= service.minHouseholdSize) matched.push(`가구원 수 충족`)
      else failed.push(`가구원 수 미달`)
    }
    if (service.regions && service.regions.length > 0) {
      if (service.regions.includes(citizen.region)) matched.push(`지역 ${citizen.region}`)
      else failed.push(`지역 불일치`)
    }

    let status: EligibilityStatus = 'NOT_ELIGIBLE'
    if (failed.length === 0 && matched.length > 0) status = 'ELIGIBLE'
    else if (failed.length === 0 && matched.length === 0) status = 'ELIGIBLE'  // 제약 없음
    else if (matched.length > 0 && failed.length > 0) status = 'PARTIAL'

    this.appendAudit('eligibility.check', this.maskId(citizenId), { serviceId, status })
    return { serviceId, status, matchedCriteria: matched, failedCriteria: failed }
  }

  calculatePriority(citizenId: string, serviceId: string): number {
    const citizen = this.citizens.get(citizenId)
    const service = this.services.get(serviceId)
    if (!citizen) throw new Error(`Unknown citizen: ${citizenId}`)
    if (!service) throw new Error(`Unknown service: ${serviceId}`)

    const eligibility = this.checkEligibility(citizenId, serviceId)
    let eligibilityScore = 0
    if (eligibility.status === 'ELIGIBLE') eligibilityScore = 60
    else if (eligibility.status === 'PARTIAL') eligibilityScore = 25

    const urgencyScore = (service.urgencyScore / 100) * 20
    const preferenceScore = citizen.preferences.includes(service.category) ? 20 : 0

    return Math.round(eligibilityScore + urgencyScore + preferenceScore)
  }

  recommend(citizenId: string, topN: number = 5): Recommendation[] {
    const citizen = this.citizens.get(citizenId)
    if (!citizen) throw new Error(`Unknown citizen: ${citizenId}`)

    const recs: Recommendation[] = []
    for (const service of this.services.values()) {
      const eligibility = this.checkEligibility(citizenId, service.serviceId)
      if (eligibility.status === 'NOT_ELIGIBLE') continue
      const priorityScore = this.calculatePriority(citizenId, service.serviceId)
      recs.push({
        serviceId: service.serviceId,
        name: service.name,
        category: service.category,
        priorityScore,
        eligibility: eligibility.status,
        reason:
          eligibility.status === 'ELIGIBLE'
            ? '모든 자격 요건 충족'
            : `일부 자격 충족 (${eligibility.matchedCriteria.length}/${eligibility.matchedCriteria.length + eligibility.failedCriteria.length})`,
      })
    }
    recs.sort((a, b) => b.priorityScore - a.priorityScore)
    const top = recs.slice(0, topN)
    this.appendAudit('recommend', this.maskId(citizenId), { returned: top.length })
    return top
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private maskId(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private ageRange(age: number): string {
    const decade = Math.floor(age / 10) * 10
    return `${decade}대`
  }

  private appendAudit(action: string, citizenIdMasked: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      citizenIdMasked,
      detail,
    })
  }
}
