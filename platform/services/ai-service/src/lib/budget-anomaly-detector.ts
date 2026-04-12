/**
 * Budget Anomaly Detector — SVC-AI-ADV-R192 (트랙 B 5차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R192/SVC-AI-ADV-R192.design.md
 * Plan SC: FR-R192.1 ~ FR-R192.5
 *
 * 예산 항목별 지출 Z-score 이상 탐지 + 집행률 리포트.
 */

export interface BudgetItem {
  itemId: string
  department: string
  annualBudget: number
  name: string
}

export interface Expenditure {
  itemId: string
  date: string
  amount: number
  description: string
}

export interface AnomalyExpenditure {
  itemId: string
  date: string
  amount: number
  zScore: number
  reason: string
}

export interface BudgetReport {
  itemId: string
  name: string
  annualBudget: number
  totalSpent: number
  executionRate: number
  anomalies: AnomalyExpenditure[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  itemId: string
  detail: Record<string, unknown>
}

export class BudgetAnomalyDetector {
  private readonly items = new Map<string, BudgetItem>()
  private readonly expenditures = new Map<string, Expenditure[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R192.1
  registerItem(item: BudgetItem): void {
    this.items.set(item.itemId, { ...item })
    this.expenditures.set(item.itemId, [])
    this.appendAudit('item.register', item.itemId, { name: item.name, annualBudget: item.annualBudget })
  }

  // Plan SC: FR-R192.2
  recordExpenditure(exp: Expenditure): void {
    if (!this.items.has(exp.itemId)) throw new Error(`Unknown item: ${exp.itemId}`)
    const list = this.expenditures.get(exp.itemId) ?? []
    list.push({ ...exp })
    this.expenditures.set(exp.itemId, list)
  }

  // Plan SC: FR-R192.3 — Design Ref: §알고리즘 Z-score
  detectAnomalies(itemId: string): AnomalyExpenditure[] {
    const exps = this.expenditures.get(itemId) ?? []
    if (exps.length < 2) return []

    const amounts = exps.map((e) => e.amount)
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length
    const std = Math.sqrt(variance)
    if (std === 0) return []

    const anomalies: AnomalyExpenditure[] = []
    for (const exp of exps) {
      const zScore = (exp.amount - mean) / std
      if (zScore > 2.0) {
        anomalies.push({
          itemId,
          date: exp.date,
          amount: exp.amount,
          zScore: Math.round(zScore * 100) / 100,
          reason: `이상 지출: Z-score ${(Math.round(zScore * 100) / 100)} (기준 2.0 초과)`,
        })
      }
    }

    this.appendAudit('anomaly.detect', itemId, { anomalyCount: anomalies.length })
    return anomalies
  }

  // Plan SC: FR-R192.4 — 집행률 리포트
  getReport(itemId: string): BudgetReport {
    const item = this.items.get(itemId)
    if (!item) throw new Error(`Unknown item: ${itemId}`)
    const exps = this.expenditures.get(itemId) ?? []
    const totalSpent = exps.reduce((s, e) => s + e.amount, 0)
    const executionRate = item.annualBudget === 0 ? 0 : totalSpent / item.annualBudget
    const anomalies = this.detectAnomalies(itemId)

    return {
      itemId,
      name: item.name,
      annualBudget: item.annualBudget,
      totalSpent,
      executionRate: Math.round(executionRate * 10000) / 10000,
      anomalies,
    }
  }

  // Plan SC: FR-R192.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, itemId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, itemId, detail })
  }
}
