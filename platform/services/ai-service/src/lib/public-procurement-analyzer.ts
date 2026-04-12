/**
 * Public Procurement Analyzer — SVC-AI-ADV-R188 (트랙 B 5차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R188/SVC-AI-ADV-R188.design.md
 * Plan SC: FR-R188.1 ~ FR-R188.5
 *
 * 공공조달 입찰/낙찰 분석 + 이상 낙찰 탐지. 순수 계산.
 */

export type ProcurementMethod = 'LOWEST_PRICE' | 'QUALIFIED' | 'COMPREHENSIVE'

export interface Tender {
  tenderId: string
  item: string
  budget: number
  deadline: string
  method: ProcurementMethod
}

export interface Award {
  tenderId: string
  awardedPrice: number
  vendor: string
  awardedAt: string
}

export interface AnomalyResult {
  tenderId: string
  awardRate: number
  isAnomaly: boolean
  reason: string
}

export interface ProcurementStats {
  item: string
  avgAwardRate: number
  count: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class PublicProcurementAnalyzer {
  private readonly tenders = new Map<string, Tender>()
  private readonly awards = new Map<string, Award>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R188.1
  registerTender(tender: Tender): void {
    this.tenders.set(tender.tenderId, { ...tender })
    this.appendAudit('tender.register', { tenderId: tender.tenderId, budget: tender.budget })
  }

  // Plan SC: FR-R188.2 + FR-R188.3 — Design Ref: §알고리즘
  recordAward(award: Award): AnomalyResult {
    const tender = this.tenders.get(award.tenderId)
    if (!tender) throw new Error(`Unknown tender: ${award.tenderId}`)

    this.awards.set(award.tenderId, { ...award })
    const awardRate = award.awardedPrice / tender.budget

    let isAnomaly = false
    let reason = '정상'
    if (awardRate < 0.5) {
      isAnomaly = true
      reason = `덤핑 의심: 낙찰률 ${(awardRate * 100).toFixed(1)}% (기준 50% 미만)`
    } else if (awardRate > 1.0) {
      isAnomaly = true
      reason = `예산 초과: 낙찰률 ${(awardRate * 100).toFixed(1)}% (예산 초과)`
    }

    const result: AnomalyResult = {
      tenderId: award.tenderId,
      awardRate: Math.round(awardRate * 10000) / 10000,
      isAnomaly,
      reason,
    }
    this.appendAudit('award.record', { tenderId: award.tenderId, isAnomaly, awardRate: result.awardRate })
    return result
  }

  // Plan SC: FR-R188.4 — 품목별 통계
  getStats(): ProcurementStats[] {
    const itemMap = new Map<string, number[]>()
    for (const [tenderId, award] of this.awards.entries()) {
      const tender = this.tenders.get(tenderId)
      if (!tender) continue
      const rates = itemMap.get(tender.item) ?? []
      rates.push(award.awardedPrice / tender.budget)
      itemMap.set(tender.item, rates)
    }
    return [...itemMap.entries()].map(([item, rates]) => ({
      item,
      avgAwardRate: Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 10000) / 10000,
      count: rates.length,
    }))
  }

  // Plan SC: FR-R188.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
