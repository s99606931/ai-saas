// Design Ref: §R207 — AI기반 공공 조달 리스크 평가
// Plan SC: SVC-AI-ADV-R207-SC01

export interface ProcurementItem {
  itemId: string
  name: string
  estimatedBudget: number
  category: 'IT' | 'CONSTRUCTION' | 'SERVICE' | 'GOODS'
  vendorCount: number
  isEmergency: boolean
}

export interface BidRecord {
  itemId: string
  bidId: string
  vendorId: string
  bidPrice: number
  technicalScore: number
}

export type RiskLevel = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface RiskAssessment {
  itemId: string
  riskLevel: RiskLevel
  riskScore: number
  riskFactors: string[]
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  itemId: string
  detail: Record<string, unknown>
}

export class ProcurementRiskAssessorAI {
  private items = new Map<string, ProcurementItem>()
  private bids = new Map<string, BidRecord[]>()
  private auditLog: AuditEntry[] = []

  registerItem(item: ProcurementItem): void {
    this.items.set(item.itemId, item)
    this.bids.set(item.itemId, [])
    this.appendAudit('item.register', item.itemId, { name: item.name })
  }

  recordBid(bid: BidRecord): void {
    if (!this.items.has(bid.itemId)) throw new Error(`Unknown item: ${bid.itemId}`)
    const list = this.bids.get(bid.itemId) ?? []
    list.push(bid)
    this.bids.set(bid.itemId, list)
  }

  assess(itemId: string): RiskAssessment {
    const item = this.items.get(itemId)
    if (!item) throw new Error(`Unknown item: ${itemId}`)

    const bids = this.bids.get(itemId) ?? []
    const riskFactors: string[] = []
    let riskScore = 0

    // 입찰 경쟁 부족
    if (bids.length < 2) {
      riskFactors.push('입찰 경쟁 부족 (2개 미만)')
      riskScore += 30
    }

    // 단독 입찰
    if (bids.length === 1) {
      riskFactors.push('단독 입찰')
      riskScore += 20
    }

    // 긴급 조달
    if (item.isEmergency) {
      riskFactors.push('긴급 조달 — 검토 기간 단축')
      riskScore += 20
    }

    // 고액 예산
    if (item.estimatedBudget >= 1_000_000_000) {
      riskFactors.push('10억 이상 대규모 계약')
      riskScore += 15
    }

    // 낮은 낙찰 가격 이상 (덤핑 의심)
    if (bids.length > 0) {
      const avgBid = bids.reduce((s, b) => s + b.bidPrice, 0) / bids.length
      const minBid = Math.min(...bids.map((b) => b.bidPrice))
      if (minBid < avgBid * 0.7) {
        riskFactors.push('최저가 입찰 덤핑 의심 (평균 대비 30% 이하)')
        riskScore += 25
      }
    }

    const riskLevel: RiskLevel =
      riskScore >= 70 ? 'VERY_HIGH' : riskScore >= 45 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW'

    const recommendation =
      riskLevel === 'VERY_HIGH' ? '감사 필수 — 계약 전 전문가 검토 및 상위 승인 필요'
        : riskLevel === 'HIGH' ? '주의 — 입찰 절차 재검토 권장'
        : riskLevel === 'MEDIUM' ? '모니터링 — 추가 서류 확인 권장'
        : '정상 — 일반 검토 절차 진행'

    this.appendAudit('risk.assess', itemId, { riskLevel, riskScore })
    return { itemId, riskLevel, riskScore, riskFactors, recommendation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, itemId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, itemId, detail })
  }
}
