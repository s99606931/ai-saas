// Plan SC: SVC-AI-ADV-R634
// Design Ref: §TREND_WEIGHT — 최근 3년 세입 추세 기반 지수가중 예측

type DataGrade = 'O' | 'C' | 'S'
type RevenueCategory = 'propertyTax' | 'acquisitionTax' | 'localIncomeTax' | 'other'

interface YearlyRevenue {
  year: number
  category: RevenueCategory
  amount: number
}

interface ForecastResult {
  category: RevenueCategory
  nextYear: number
  forecastAmount: number
  confidence: number
  growthRate: number
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export class MunicipalRevenueForecastAI {
  private records: YearlyRevenue[] = []
  private auditLog: AuditEntry[] = []

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  addRecord(record: YearlyRevenue, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade)
    this.records.push(record)
    this.log('record.add', `year=${record.year} category=${record.category}`)
  }

  forecast(category: RevenueCategory): ForecastResult {
    const filtered = this.records
      .filter((r) => r.category === category)
      .sort((a, b) => a.year - b.year)

    if (filtered.length < 2) {
      throw new Error('forecast requires at least 2 historical records')
    }

    const weights = [0.5, 0.3, 0.2]
    const recent = filtered.slice(-Math.min(3, filtered.length))

    let weightedGrowth = 0
    let totalWeight = 0
    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1]!
      const curr = recent[i]!
      const growth = (curr.amount - prev.amount) / prev.amount
      const w = weights[i - 1] ?? 0.2
      weightedGrowth += growth * w
      totalWeight += w
    }
    const growthRate = totalWeight > 0 ? weightedGrowth / totalWeight : 0

    const lastEntry = recent[recent.length - 1]!
    const forecastAmount = Math.round(lastEntry.amount * (1 + growthRate))
    const confidence = Math.min(1, recent.length / 3)

    const result: ForecastResult = {
      category,
      nextYear: lastEntry.year + 1,
      forecastAmount,
      confidence,
      growthRate,
    }
    this.log(
      'forecast.calc',
      `category=${category} forecast=${forecastAmount} growthRate=${growthRate.toFixed(4)}`,
    )
    return result
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
