/**
 * AI 기반 서비스 카탈로그 자동화 — SVC-AI-ADV-R182
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R182/SVC-AI-ADV-R182.design.md
 * Plan SC: FR-R182.1 ~ FR-R182.5
 *
 * SaaS 서비스 카탈로그 관리 + 요구사항 기반 추천 + 플랜 비교.
 * CSAP D-12, N2SF N-05 등급 차단.
 *
 * NOTE: 파일명에 -r182 suffix 추가 — service-catalog-ai.ts (FR-N405)와 충돌 방지.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface ServicePlan {
  name: string
  monthlyPrice: number
  features: string[]
  maxUsers: number
}

export interface CatalogServiceR182 {
  id: string
  name: string
  category: string
  keywords: string[]
  plans: ServicePlan[]
}

export interface ServiceMatch {
  service: CatalogServiceR182
  matchScore: number
  recommendedPlan: ServicePlan
}

export interface PlanComparison {
  services: Array<{
    serviceId: string
    serviceName: string
    plan: ServicePlan
  }>
  cheapestServiceId: string
  featureMatrix: Record<string, string[]>
}

export interface SCAAuditEntry {
  action: 'serviceRegistered' | 'searched' | 'compared'
  timestamp: number
  details: Record<string, unknown>
}

export class ServiceCatalogAI {
  private readonly services = new Map<string, CatalogServiceR182>()
  private readonly auditLog: SCAAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 서비스 카탈로그 AI 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R182.1 */
  registerService(svc: CatalogServiceR182): void {
    if (!svc.id.trim()) throw new Error('service id must not be empty')
    if (svc.plans.length === 0) throw new Error('at least one plan required')
    this.services.set(svc.id, {
      ...svc,
      keywords: [...svc.keywords],
      plans: svc.plans.map((p) => ({ ...p, features: [...p.features] })),
    })
    this.audit('serviceRegistered', { id: svc.id, name: svc.name, plans: svc.plans.length })
  }

  /** FR-R182.2 ~ FR-R182.3 */
  search(requirements: string[]): ServiceMatch[] {
    const reqSet = new Set(requirements.map((r) => r.toLowerCase()))
    const results: ServiceMatch[] = []

    for (const svc of this.services.values()) {
      const kwSet = new Set(svc.keywords.map((k) => k.toLowerCase()))
      let matched = 0
      for (const req of reqSet) {
        if (kwSet.has(req)) matched++
      }
      const matchScore = reqSet.size > 0 ? matched / reqSet.size : 0
      if (matchScore > 0) {
        const sorted = [...svc.plans].sort((a, b) => a.monthlyPrice - b.monthlyPrice)
        results.push({ service: svc, matchScore, recommendedPlan: sorted[0]! })
      }
    }

    results.sort((a, b) => b.matchScore - a.matchScore)
    this.audit('searched', { requirements: requirements.length, results: results.length })
    return results
  }

  /** FR-R182.4 */
  comparePlans(serviceIds: string[]): PlanComparison {
    const items: PlanComparison['services'] = []
    const featureMatrix: Record<string, string[]> = {}

    for (const id of serviceIds) {
      const svc = this.services.get(id)
      if (!svc) continue
      const cheapestPlan = [...svc.plans].sort((a, b) => a.monthlyPrice - b.monthlyPrice)[0]!
      items.push({ serviceId: id, serviceName: svc.name, plan: cheapestPlan })
      featureMatrix[id] = cheapestPlan.features
    }

    const cheapestItem = items.reduce(
      (min, item) => (item.plan.monthlyPrice < min.plan.monthlyPrice ? item : min),
      items[0] ?? { serviceId: '', serviceName: '', plan: { name: '', monthlyPrice: Infinity, features: [], maxUsers: 0 } },
    )

    this.audit('compared', { services: items.length })
    return { services: items, cheapestServiceId: cheapestItem.serviceId, featureMatrix }
  }

  /** FR-R182.5 */
  getAuditLog(): readonly SCAAuditEntry[] {
    return [...this.auditLog]
  }

  private audit(action: SCAAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
