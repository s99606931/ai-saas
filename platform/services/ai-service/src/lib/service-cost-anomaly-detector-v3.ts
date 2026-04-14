// Design Ref: §R486 — AI기반 자동 서비스 비용 이상 탐지 v3
// Plan SC: SVC-AI-ADV-R486-SC01

export type AnomalySeverity = 'INFO' | 'WARNING' | 'CRITICAL'
export type CostCategory = 'COMPUTE' | 'STORAGE' | 'NETWORK' | 'LICENSE' | 'SUPPORT' | 'OTHER'

export interface CostEntry {
  entryId: string
  serviceId: string
  category: CostCategory
  month: string     // YYYY-MM
  amountKrw: number
  budgetKrw: number
}

export interface CostAnomaly {
  anomalyId: string
  serviceId: string
  category: CostCategory
  month: string
  severity: AnomalySeverity
  actualKrw: number
  expectedKrw: number
  deviationPercent: number
  detail: string
}

export interface CostAnomalyReport {
  serviceId: string
  analysisMonth: string
  anomalies: CostAnomaly[]
  totalActualKrw: number
  totalBudgetKrw: number
  budgetUtilization: number   // actualKrw / budgetKrw
  overBudget: boolean
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class ServiceCostAnomalyDetectorV3 {
  private entries = new Map<string, CostEntry[]>()   // `${serviceId}:${category}` → entries
  private auditLog: AuditEntry[] = []

  ingestEntry(entry: CostEntry): void {
    const key = `${entry.serviceId}:${entry.category}`
    const list = this.entries.get(key) ?? []
    list.push(entry)
    list.sort((a, b) => a.month.localeCompare(b.month))
    this.entries.set(key, list)
    this.appendAudit('entry.ingest', entry.serviceId, { category: entry.category, month: entry.month, amountKrw: entry.amountKrw })
  }

  detect(serviceId: string, analysisMonth: string): CostAnomalyReport {
    this.appendAudit('anomaly.detect', serviceId, { analysisMonth })

    const anomalies: CostAnomaly[] = []
    const categories: CostCategory[] = ['COMPUTE', 'STORAGE', 'NETWORK', 'LICENSE', 'SUPPORT', 'OTHER']
    let totalActualKrw = 0
    let totalBudgetKrw = 0

    for (const category of categories) {
      const key = `${serviceId}:${category}`
      const history = this.entries.get(key) ?? []
      const current = history.find((e) => e.month === analysisMonth)
      if (!current) continue

      totalActualKrw += current.amountKrw
      totalBudgetKrw += current.budgetKrw

      // 전월 대비 이상 탐지
      const prevEntries = history.filter((e) => e.month < analysisMonth)
      if (prevEntries.length > 0) {
        const avgPrev = prevEntries.reduce((s, e) => s + e.amountKrw, 0) / prevEntries.length
        const deviationPercent = avgPrev > 0
          ? Math.round(((current.amountKrw - avgPrev) / avgPrev) * 100)
          : 0

        const severity: AnomalySeverity =
          Math.abs(deviationPercent) >= 50 ? 'CRITICAL'
            : Math.abs(deviationPercent) >= 20 ? 'WARNING'
            : 'INFO'

        if (severity !== 'INFO') {
          anomalies.push({
            anomalyId: `ANO-${serviceId}-${category}-${analysisMonth}`,
            serviceId,
            category,
            month: analysisMonth,
            severity,
            actualKrw: current.amountKrw,
            expectedKrw: Math.round(avgPrev),
            deviationPercent,
            detail: `${category} 비용 ${deviationPercent > 0 ? '급증' : '급감'} ${Math.abs(deviationPercent)}% — 평균 ${Math.round(avgPrev).toLocaleString()}원 대비`,
          })
        }
      }

      // 예산 초과 탐지
      if (current.amountKrw > current.budgetKrw * 1.1) {
        anomalies.push({
          anomalyId: `ANO-${serviceId}-${category}-BUDGET-${analysisMonth}`,
          serviceId,
          category,
          month: analysisMonth,
          severity: 'CRITICAL',
          actualKrw: current.amountKrw,
          expectedKrw: current.budgetKrw,
          deviationPercent: Math.round(((current.amountKrw - current.budgetKrw) / current.budgetKrw) * 100),
          detail: `${category} 예산 10% 초과 — ${current.amountKrw.toLocaleString()}원 / 예산 ${current.budgetKrw.toLocaleString()}원`,
        })
      }
    }

    const budgetUtilization = totalBudgetKrw > 0 ? totalActualKrw / totalBudgetKrw : 0
    const overBudget = budgetUtilization > 1.0

    const recommendations: string[] = []
    const criticalAnomalies = anomalies.filter((a) => a.severity === 'CRITICAL')
    if (criticalAnomalies.length > 0) {
      recommendations.push(`${criticalAnomalies.length}개 항목 즉시 원인 조사 및 예산 재검토 필요`)
    }
    if (overBudget) {
      recommendations.push(`총 예산 초과 (${(budgetUtilization * 100).toFixed(0)}%) — 비용 절감 계획 수립`)
    }

    return { serviceId, analysisMonth, anomalies, totalActualKrw, totalBudgetKrw, budgetUtilization, overBudget, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
