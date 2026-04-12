/**
 * Tenant Billing Reporter — SVC-AI-ADV-R144
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R144.design.md
 * Plan SC: FR-R144.1 ~ FR-R144.6
 *
 * 테넌트별 AI 사용량 기간 청구서 생성. 결정론적 산출.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface UsageRecord {
  tenantId: string
  modelId: string
  inputTokens: number
  outputTokens: number
  at: number
}

export interface ModelRate {
  modelId: string
  inputPerK: number
  outputPerK: number
  currency: 'KRW'
}

export interface BillingLine {
  modelId: string
  inputTokens: number
  outputTokens: number
  grossAmount: number
  discountAmount: number
  netAmount: number
}

export interface BillingReport {
  tenantId: string
  periodStart: number
  periodEnd: number
  lines: BillingLine[]
  totalGross: number
  totalDiscount: number
  totalNet: number
  currency: 'KRW'
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface ReporterOptions {
  now?: () => number
}

export class TenantBillingReporter {
  private readonly rates = new Map<string, ModelRate>()
  private readonly discounts = new Map<string, number>()
  private readonly usage: UsageRecord[] = []
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number

  constructor(opts: ReporterOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R144.2: 단가 등록 */
  setRate(rate: ModelRate): void {
    if (rate.inputPerK < 0 || rate.outputPerK < 0) {
      throw new Error('invalid_rate')
    }
    this.rates.set(rate.modelId, { ...rate })
    this.audit('rate_set', { modelId: rate.modelId })
  }

  /** FR-R144.4: 테넌트 할인율 설정 (0..0.5) */
  setDiscount(tenantId: string, rate: number): void {
    if (rate < 0 || rate > 0.5) {
      throw new Error('invalid_discount')
    }
    this.discounts.set(tenantId, rate)
    this.audit('discount_set', { tenantId, rate })
  }

  /** FR-R144.1: 사용량 기록 */
  record(usage: UsageRecord, grade: DataGrade = 'O'): void {
    this.assertGrade(grade)
    if (usage.inputTokens < 0 || usage.outputTokens < 0) {
      throw new Error('invalid_tokens')
    }
    if (!usage.tenantId || !usage.modelId) {
      throw new Error('invalid_record')
    }
    this.usage.push({ ...usage })
    this.audit('usage_recorded', {
      tenantId: usage.tenantId,
      modelId: usage.modelId,
    })
  }

  /** FR-R144.3: 기간 청구서 생성 */
  generate(
    tenantId: string,
    periodStart: number,
    periodEnd: number,
  ): BillingReport {
    if (periodEnd < periodStart) {
      throw new Error('invalid_period')
    }
    const filtered = this.usage.filter(
      (u) =>
        u.tenantId === tenantId &&
        u.at >= periodStart &&
        u.at <= periodEnd,
    )
    const grouped = new Map<
      string,
      { inputTokens: number; outputTokens: number }
    >()
    for (const u of filtered) {
      const cur = grouped.get(u.modelId) ?? {
        inputTokens: 0,
        outputTokens: 0,
      }
      cur.inputTokens += u.inputTokens
      cur.outputTokens += u.outputTokens
      grouped.set(u.modelId, cur)
    }
    const discountRate = this.discounts.get(tenantId) ?? 0
    const lines: BillingLine[] = []
    let totalGross = 0
    let totalDiscount = 0
    for (const [modelId, agg] of grouped.entries()) {
      const rate = this.rates.get(modelId)
      if (!rate) {
        throw new Error('rate_missing')
      }
      const gross = this.round(
        (agg.inputTokens / 1000) * rate.inputPerK +
          (agg.outputTokens / 1000) * rate.outputPerK,
      )
      const discount = this.round(gross * discountRate)
      const net = gross - discount
      lines.push({
        modelId,
        inputTokens: agg.inputTokens,
        outputTokens: agg.outputTokens,
        grossAmount: gross,
        discountAmount: discount,
        netAmount: net,
      })
      totalGross += gross
      totalDiscount += discount
    }
    lines.sort((a, b) => a.modelId.localeCompare(b.modelId))
    const report: BillingReport = {
      tenantId,
      periodStart,
      periodEnd,
      lines,
      totalGross,
      totalDiscount,
      totalNet: totalGross - totalDiscount,
      currency: 'KRW',
    }
    this.audit('report_generated', {
      tenantId,
      periodStart,
      periodEnd,
      totalNet: report.totalNet,
    })
    return report
  }

  /** FR-R144.5: 감사 로그 조회 */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private round(value: number): number {
    return Math.round(value)
  }

  /** FR-R144.6: C/S등급 차단 */
  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
