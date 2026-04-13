// Design Ref: §R503 — 공공 조달 부정 탐지 AI
// Plan SC: SVC-AI-ADV-R503-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type FraudRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export interface Bid {
  bidId: string
  vendorId: string
  amount: number
  submittedAt: string
}

export interface ProcurementCase {
  caseId: string
  estimatedValue: number
  bids: Bid[]
  winnerBidId?: string
}

export interface FraudAnalysis {
  caseId: string
  risk: FraudRisk
  riskScore: number
  flags: string[]
  bidCount: number
  winnerVendorId: string | null
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class AiPublicProcurementFraud {
  private readonly cases = new Map<string, ProcurementCase>()
  private readonly auditLog: AuditEntry[] = []

  registerCase(c: ProcurementCase, grade: DataGrade): void {
    blockClassifiedData(grade)
    if (!c.caseId) throw new Error('caseId 필수')
    if (c.estimatedValue <= 0) throw new Error('estimatedValue는 양수')
    if (this.cases.has(c.caseId)) throw new Error(`중복 caseId: ${c.caseId}`)
    this.cases.set(c.caseId, { ...c, bids: [...c.bids] })
    this.appendAudit('case.register', { caseId: c.caseId, bidCount: c.bids.length })
  }

  analyze(caseId: string): FraudAnalysis {
    const c = this.cases.get(caseId)
    if (!c) throw new Error(`caseId 없음: ${caseId}`)
    const flags: string[] = []
    let score = 0

    // 1. 단독 입찰
    if (c.bids.length === 1) {
      flags.push('SINGLE_BID')
      score += 30
    }

    // 2. 입찰 가격 클러스터링 (담합 의심)
    if (c.bids.length >= 2) {
      const sorted = [...c.bids].sort((a, b) => a.amount - b.amount)
      const min = sorted[0]?.amount ?? 0
      const max = sorted[sorted.length - 1]?.amount ?? 0
      const spread = max > 0 ? (max - min) / max : 0
      if (spread < 0.02) {
        flags.push('PRICE_CLUSTERING')
        score += 40
      }
    }

    // 3. 추정가 대비 낙찰가 비율
    if (c.winnerBidId) {
      const winner = c.bids.find((b) => b.bidId === c.winnerBidId)
      if (winner) {
        const ratio = winner.amount / c.estimatedValue
        if (ratio > 0.99) {
          flags.push('NEAR_ESTIMATE_WIN')
          score += 25
        }
        if (ratio < 0.6) {
          flags.push('SUSPICIOUSLY_LOW_BID')
          score += 35
        }
      }
    }

    // 4. 동일 시각 제출 (담합)
    const submitTimes = new Set(c.bids.map((b) => b.submittedAt))
    if (c.bids.length >= 2 && submitTimes.size === 1) {
      flags.push('SAME_SUBMIT_TIME')
      score += 20
    }

    const risk = this.scoreToRisk(score)
    const winner = c.winnerBidId ? c.bids.find((b) => b.bidId === c.winnerBidId) : null
    const winnerVendorId = winner?.vendorId ?? null

    this.appendAudit('case.analyze', { caseId, risk, score, flagCount: flags.length })

    return {
      caseId,
      risk,
      riskScore: score,
      flags,
      bidCount: c.bids.length,
      winnerVendorId,
    }
  }

  listCases(): string[] {
    return [...this.cases.keys()]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private scoreToRisk(score: number): FraudRisk {
    if (score >= 70) return 'CRITICAL'
    if (score >= 50) return 'HIGH'
    if (score >= 25) return 'MEDIUM'
    return 'LOW'
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
