// Design Ref: §R425 — Tax Compliance Checker AI
// Plan SC: SC-R425

export interface TaxFiling {
  readonly filingId: string
  readonly taxpayerId: string
  readonly income: number
  readonly deduction: number
  readonly declaredTax: number
  readonly calculatedTax: number
}

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface Issue {
  readonly code: string
  readonly severity: Severity
  readonly message: string
}

export interface CheckResult {
  readonly filingId: string
  readonly compliant: boolean
  readonly issues: readonly Issue[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskTaxpayerId(id: string): string {
  if (id.length <= 3) return '*'.repeat(id.length)
  return id.slice(0, 2) + '*'.repeat(id.length - 4) + id.slice(-2)
}

export class ServiceResilienceTesterAi {
  private auditLog: AuditEntry[] = []

  check(filing: TaxFiling): CheckResult {
    const issues: Issue[] = []

    // 필수 필드 누락
    if (!filing.filingId || !filing.taxpayerId) {
      issues.push({ code: 'MISSING_FIELD', severity: 'CRITICAL', message: '필수 필드(filingId/taxpayerId) 누락' })
    }

    // 과다 공제
    if (filing.deduction > filing.income * 0.5) {
      issues.push({ code: 'OVER_DEDUCTION', severity: 'HIGH', message: `공제액(${filing.deduction})이 소득(${filing.income})의 50% 초과` })
    }

    // 계산 불일치
    if (Math.abs(filing.declaredTax - filing.calculatedTax) > 100) {
      issues.push({ code: 'CALC_MISMATCH', severity: 'MEDIUM', message: `신고세액과 계산세액 차이: ${Math.abs(filing.declaredTax - filing.calculatedTax)}원` })
    }

    const compliant = !issues.some((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH')

    this.auditLog.push({ action: 'tax.check', timestamp: new Date().toISOString(), detail: `${maskTaxpayerId(filing.taxpayerId)}:${compliant ? 'COMPLIANT' : 'NON_COMPLIANT'}` })
    return { filingId: filing.filingId, compliant, issues }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
