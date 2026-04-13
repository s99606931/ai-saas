// Design Ref: §R421 — AI-Powered Grant Reviewer
// Plan SC: SC-R421

export type DataGrade = 'O' | 'C' | 'S'

export interface GrantApplication {
  readonly applicantId: string
  readonly income: number
  readonly age: number
  readonly familySize: number
  readonly fraudHistory: boolean
  readonly dataGrade: DataGrade
}

export interface GrantRule {
  readonly incomeCap: number
  readonly minAge: number
  readonly baseAmount: number
}

export interface ReviewResult {
  readonly applicantId: string
  readonly eligible: boolean
  readonly recommendedAmount: number
  readonly riskLevel: 'LOW' | 'HIGH'
  readonly reasonCode: string
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskApplicantId(id: string): string {
  if (id.length <= 3) return '*'.repeat(id.length)
  return id.slice(0, 2) + '*'.repeat(id.length - 4) + id.slice(-2)
}

export class ApiRateLimiterOptimizerAi {
  private rule: GrantRule | null = null
  private auditLog: AuditEntry[] = []

  setRule(rule: GrantRule): void {
    this.rule = rule
    this.auditLog.push({ action: 'rule.set', timestamp: new Date().toISOString(), detail: `cap=${rule.incomeCap}` })
  }

  review(app: GrantApplication): ReviewResult {
    // N2SF: C/S 등급 차단
    if (app.dataGrade === 'C' || app.dataGrade === 'S') {
      throw new Error(`BLOCKED: ${app.dataGrade}등급 데이터 처리 차단 (N2SF N-05)`)
    }

    if (!this.rule) throw new Error('Grant rule not configured')

    const { incomeCap, minAge, baseAmount } = this.rule
    let eligible = true
    let reasonCode = 'APPROVED'

    if (app.income > incomeCap) {
      eligible = false
      reasonCode = 'INCOME_OVER'
    } else if (app.age < minAge) {
      eligible = false
      reasonCode = 'AGE_UNDER'
    }

    const ratio = Math.max(0, Math.min(1, 1 - app.income / incomeCap))
    const recommendedAmount = eligible ? Math.round(baseAmount * ratio) : 0
    const riskLevel: 'LOW' | 'HIGH' = app.fraudHistory ? 'HIGH' : 'LOW'

    this.auditLog.push({ action: 'grant.review', timestamp: new Date().toISOString(), detail: `${maskApplicantId(app.applicantId)}:${reasonCode}` })
    return { applicantId: app.applicantId, eligible, recommendedAmount, riskLevel, reasonCode }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
