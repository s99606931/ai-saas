// Design Ref: §설계결정 — AI기반 공공기관 예산 소진율 분석 v2
// Plan SC: FR-R580.1~5

interface BudgetItem { budgetId: string; name: string; totalBudget: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class BudgetBurnRateAnalyzerV2 {
  private budgets = new Map<string, BudgetItem>()
  private spending = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerBudget(budgetId: string, name: string, totalBudget: number): void {
    this.budgets.set(budgetId, { budgetId, name, totalBudget })
    this.spending.set(budgetId, 0)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_BUDGET', details: { budgetId, name, totalBudget } })
  }

  recordSpending(budgetId: string, amount: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const current = this.spending.get(budgetId) ?? 0
    this.spending.set(budgetId, current + amount)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_SPENDING', details: { budgetId, amount } })
  }

  getBurnRate(budgetId: string): number {
    const budget = this.budgets.get(budgetId)
    if (!budget) return 0
    const spent = this.spending.get(budgetId) ?? 0
    return (spent / budget.totalBudget) * 100
  }

  getOverBurnedBudgets(): BudgetItem[] {
    return Array.from(this.budgets.values()).filter(b => this.getBurnRate(b.budgetId) > 90)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
