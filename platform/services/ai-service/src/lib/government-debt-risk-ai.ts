// Design Ref: §R510 — 정부 부채 리스크 AI
// Plan SC: SVC-AI-ADV-R510-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type DebtRiskLevel = 'STABLE' | 'MONITORING' | 'WARNING' | 'CRITICAL'

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export interface DebtSnapshot {
  fiscalYear: number
  totalDebtKRW: number
  gdpKRW: number
  annualInterestKRW: number
  annualRevenueKRW: number
  shortTermDebtKRW: number
}

export interface DebtRiskReport {
  fiscalYear: number
  riskLevel: DebtRiskLevel
  debtToGdpPct: number
  interestToRevenuePct: number
  shortTermDebtRatio: number
  flags: string[]
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class GovernmentDebtRiskAi {
  private readonly snapshots: DebtSnapshot[] = []
  private readonly auditLog: AuditEntry[] = []

  recordSnapshot(snapshot: DebtSnapshot, grade: DataGrade): void {
    blockClassifiedData(grade)
    if (snapshot.fiscalYear < 1900) throw new Error('fiscalYear 비정상')
    if (snapshot.totalDebtKRW < 0) throw new Error('totalDebtKRW는 0 이상')
    if (snapshot.gdpKRW <= 0) throw new Error('gdpKRW는 양수')
    if (snapshot.annualRevenueKRW <= 0) throw new Error('annualRevenueKRW는 양수')
    if (snapshot.shortTermDebtKRW < 0 || snapshot.shortTermDebtKRW > snapshot.totalDebtKRW) {
      throw new Error('shortTermDebtKRW 범위 오류')
    }
    if (this.snapshots.some((s) => s.fiscalYear === snapshot.fiscalYear)) {
      throw new Error(`중복 fiscalYear: ${snapshot.fiscalYear}`)
    }
    this.snapshots.push({ ...snapshot })
    this.snapshots.sort((a, b) => a.fiscalYear - b.fiscalYear)
    this.appendAudit('snapshot.record', { fiscalYear: snapshot.fiscalYear })
  }

  evaluate(fiscalYear: number): DebtRiskReport {
    const s = this.snapshots.find((x) => x.fiscalYear === fiscalYear)
    if (!s) throw new Error(`fiscalYear 없음: ${fiscalYear}`)

    const debtToGdpPct = Math.round((s.totalDebtKRW / s.gdpKRW) * 1000) / 10
    const interestToRevenuePct = Math.round((s.annualInterestKRW / s.annualRevenueKRW) * 1000) / 10
    const shortTermDebtRatio =
      s.totalDebtKRW > 0 ? Math.round((s.shortTermDebtKRW / s.totalDebtKRW) * 1000) / 10 : 0

    const flags: string[] = []
    let riskScore = 0

    if (debtToGdpPct >= 60) {
      flags.push('HIGH_DEBT_TO_GDP')
      riskScore += 40
    } else if (debtToGdpPct >= 40) {
      flags.push('ELEVATED_DEBT_TO_GDP')
      riskScore += 20
    }

    if (interestToRevenuePct >= 10) {
      flags.push('HIGH_INTEREST_BURDEN')
      riskScore += 30
    } else if (interestToRevenuePct >= 5) {
      flags.push('ELEVATED_INTEREST_BURDEN')
      riskScore += 15
    }

    if (shortTermDebtRatio >= 30) {
      flags.push('SHORT_TERM_REFINANCING_RISK')
      riskScore += 25
    }

    // 추세 분석: 직전 연도 대비
    const prev = this.snapshots.find((x) => x.fiscalYear === fiscalYear - 1)
    if (prev) {
      const prevRatio = (prev.totalDebtKRW / prev.gdpKRW) * 100
      if (debtToGdpPct - prevRatio >= 5) {
        flags.push('RAPID_DEBT_GROWTH')
        riskScore += 15
      }
    }

    const riskLevel = this.scoreToLevel(riskScore)
    const recommendations = this.recommend(flags)

    this.appendAudit('debt.evaluate', { fiscalYear, riskLevel, riskScore })

    return {
      fiscalYear,
      riskLevel,
      debtToGdpPct,
      interestToRevenuePct,
      shortTermDebtRatio,
      flags,
      recommendations,
    }
  }

  listYears(): number[] {
    return this.snapshots.map((s) => s.fiscalYear)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private scoreToLevel(score: number): DebtRiskLevel {
    if (score >= 70) return 'CRITICAL'
    if (score >= 45) return 'WARNING'
    if (score >= 20) return 'MONITORING'
    return 'STABLE'
  }

  private recommend(flags: string[]): string[] {
    const recs: string[] = []
    if (flags.includes('HIGH_DEBT_TO_GDP')) recs.push('중기재정계획 재수립')
    if (flags.includes('HIGH_INTEREST_BURDEN')) recs.push('고금리 부채 차환 검토')
    if (flags.includes('SHORT_TERM_REFINANCING_RISK')) recs.push('만기 구조 장기화')
    if (flags.includes('RAPID_DEBT_GROWTH')) recs.push('재정준칙 강화')
    if (recs.length === 0) recs.push('정상 모니터링 유지')
    return recs
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
