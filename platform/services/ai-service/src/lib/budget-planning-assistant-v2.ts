// Design Ref: §클래스 설계 — BudgetPlanningAssistantV2
// Plan SC: SVC-AI-ADV-R536

interface BudgetItem {
  itemId: string
  name: string
  category: string
  allocatedAmount: number
}

interface AuditEntry {
  timestamp: string
  action: string
  itemId: string
  details?: Record<string, unknown>
}

export class BudgetPlanningAssistantV2 {
  private items = new Map<string, BudgetItem>()
  private spending = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerItem(itemId: string, name: string, category: string, allocatedAmount: number): BudgetItem {
    const item: BudgetItem = { itemId, name, category, allocatedAmount }
    this.items.set(itemId, item)
    this.spending.set(itemId, 0)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_ITEM', itemId, details: { name, category, allocatedAmount } })
    return item
  }

  recordSpending(itemId: string, spentAmount: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.items.has(itemId)) throw new Error(`예산 항목을 찾을 수 없습니다: ${itemId}`)
    this.spending.set(itemId, (this.spending.get(itemId) ?? 0) + spentAmount)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_SPENDING', itemId, details: { spentAmount } })
  }

  getExecutionRate(itemId: string): number {
    const item = this.items.get(itemId)
    if (!item) throw new Error(`예산 항목을 찾을 수 없습니다: ${itemId}`)
    if (item.allocatedAmount === 0) return 0
    return ((this.spending.get(itemId) ?? 0) / item.allocatedAmount) * 100
  }

  getOverBudgetItems(): BudgetItem[] {
    return Array.from(this.items.values()).filter(item => (this.spending.get(item.itemId) ?? 0) > item.allocatedAmount)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
