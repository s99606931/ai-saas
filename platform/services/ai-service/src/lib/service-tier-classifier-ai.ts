// Design Ref: §핵심 알고리즘 — 가용성 기반 Tier 분류
// Plan SC: SVC-AI-ADV-R343
export type DataGrade = 'O' | 'C' | 'S'
export type ServiceTier = 'platinum' | 'gold' | 'silver' | 'bronze'

const TIER_SCORE: Record<ServiceTier, number> = { platinum: 4, gold: 3, silver: 2, bronze: 1 }

export interface ServiceMetrics {
  availabilityPercent: number
  avgResponseMs: number
  throughput: number
}

export interface TierClassification {
  serviceId: string
  tier: ServiceTier
  availabilityPercent: number
  tierScore: number
}

export interface TierSummary {
  tier: ServiceTier
  count: number
  serviceIds: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function classifyTier(availability: number): ServiceTier {
  if (availability >= 99.9) return 'platinum'
  if (availability >= 99.5) return 'gold'
  if (availability >= 99.0) return 'silver'
  return 'bronze'
}

export class ServiceTierClassifierAI {
  private services = new Map<string, string>()
  private metrics = new Map<string, ServiceMetrics>()
  private auditLog: AuditEntry[] = []

  registerService(id: string, name: string): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    this.services.set(id, name)
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordMetrics(serviceId: string, availabilityPercent: number, avgResponseMs: number, throughput: number, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 서비스 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    this.metrics.set(serviceId, { availabilityPercent, avgResponseMs, throughput })
    this.auditLog.push({ action: 'metrics.record', timestamp: new Date().toISOString(), detail: `${serviceId}:avail=${availabilityPercent}` })
  }

  classifyTier(serviceId: string): TierClassification {
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    const m = this.metrics.get(serviceId)
    if (!m) throw new Error(`메트릭 없음: ${serviceId}`)
    const tier = classifyTier(m.availabilityPercent)
    return { serviceId, tier, availabilityPercent: m.availabilityPercent, tierScore: TIER_SCORE[tier] }
  }

  getTierSummary(): TierSummary[] {
    const groups = new Map<ServiceTier, string[]>()
    for (const serviceId of this.services.keys()) {
      if (!this.metrics.has(serviceId)) continue
      const { tier } = this.classifyTier(serviceId)
      const list = groups.get(tier) ?? []
      list.push(serviceId)
      groups.set(tier, list)
    }
    return [...groups.entries()].map(([tier, ids]) => ({ tier, count: ids.length, serviceIds: ids }))
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
