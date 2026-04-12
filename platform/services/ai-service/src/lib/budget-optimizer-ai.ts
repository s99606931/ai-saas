/**
 * Budget Optimizer AI — SVC-AI-ADV-R132 (트랙 B 2차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R130-R137-trackB/SVC-AI-ADV-R132.design.md
 * Plan SC: FR-R132.1 ~ FR-R132.5
 *
 * 지출 패턴 분석 → 예산 재배분 최적화 제안.
 * 순수 계산 — 외부 API 없음.
 *
 * NOTE: 기존 budget-analyzer-ai.ts와 별도 — 재배분 최적화 특화.
 */

// Design Ref: §2 — 타입 정의

export interface BudgetItem {
  itemId: string
  name: string
  allocated: number
  category: string
}

export interface ExpenseRecord {
  itemId: string
  amount: number
  date: string
}

export type ExecutionCategory = 'OVER' | 'UNDER' | 'NORMAL'

export interface ExecutionStatus {
  itemId: string
  name: string
  allocated: number
  spent: number
  executionRate: number
  status: ExecutionCategory
  remaining: number
}

export interface ReallocationSuggestion {
  fromItemId: string
  fromName: string
  toItemId: string
  toName: string
  amount: number
  reason: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class BudgetOptimizerAi {
  private readonly items = new Map<string, BudgetItem>()
  private readonly expenses = new Map<string, ExpenseRecord[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R132.1
  registerBudget(item: BudgetItem): void {
    if (item.allocated < 0) throw new Error('allocated must be non-negative')
    this.items.set(item.itemId, { ...item })
    this.expenses.set(item.itemId, [])
  }

  // Plan SC: FR-R132.2
  recordExpense(itemId: string, amount: number, date: string): void {
    if (!this.items.has(itemId)) throw new Error(`Unknown budget item: ${itemId}`)
    if (amount < 0) throw new Error('amount must be non-negative')
    const list = this.expenses.get(itemId) ?? []
    list.push({ itemId, amount, date })
    this.expenses.set(itemId, list)
  }

  // Plan SC: FR-R132.3 — Design Ref: §3.1~§3.2
  analyzeExecution(): ExecutionStatus[] {
    const result: ExecutionStatus[] = []
    for (const item of this.items.values()) {
      const records = this.expenses.get(item.itemId) ?? []
      const spent = records.reduce((sum, r) => sum + r.amount, 0)
      const executionRate = item.allocated > 0 ? spent / item.allocated : 0
      let status: ExecutionCategory = 'NORMAL'
      if (executionRate > 0.95) status = 'OVER'
      else if (executionRate < 0.5) status = 'UNDER'
      result.push({
        itemId: item.itemId,
        name: item.name,
        allocated: item.allocated,
        spent,
        executionRate,
        status,
        remaining: Math.max(0, item.allocated - spent),
      })
    }
    this.appendAudit('execution.analyze', { itemCount: result.length })
    return result
  }

  // Plan SC: FR-R132.4 — Design Ref: §3.3
  suggestReallocation(): ReallocationSuggestion[] {
    const statuses = this.analyzeExecution()
    const underItems = statuses
      .filter((s) => s.status === 'UNDER')
      .sort((a, b) => a.executionRate - b.executionRate)
    const overItems = statuses
      .filter((s) => s.status === 'OVER')
      .sort((a, b) => b.executionRate - a.executionRate)

    const suggestions: ReallocationSuggestion[] = []
    for (const under of underItems) {
      for (const over of overItems) {
        const transferAmount = Math.floor(under.remaining * 0.3)
        if (transferAmount <= 0) continue
        suggestions.push({
          fromItemId: under.itemId,
          fromName: under.name,
          toItemId: over.itemId,
          toName: over.name,
          amount: transferAmount,
          reason: `${under.name} 집행률 ${(under.executionRate * 100).toFixed(0)}% (잔액 ${under.remaining.toLocaleString()}원) → ${over.name} 초과 집행 지원`,
        })
      }
    }

    this.appendAudit('reallocation.suggest', { suggestionCount: suggestions.length })
    return suggestions
  }

  // Plan SC: FR-R132.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      detail,
    })
  }
}
