/**
 * Predictive Budget Planner V3 — SVC-AI-ADV-R661 (트랙 A 24차)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R661.design.md
 * Plan SC: FR-R661.1 ~ FR-R661.6
 *
 * 운영 비용 추세 + 잔여 예산 기반 종료 시점 예측.
 * N2SF N-05: C/S 등급 차단.
 */

export type DataGrade = 'C' | 'S' | 'O'
export type WarnLevel = 'CRITICAL' | 'WARN' | 'OK'

export interface Budget {
  budgetId: string
  totalAmount: number
  grade: DataGrade
  createdAt: string
}

export interface Expense {
  budgetId: string
  timestamp: string // ISO
  amount: number
}

export interface Forecast {
  budgetId: string
  totalAmount: number
  spent: number
  remaining: number
  monthsObserved: number
  monthlyAverage: number
  monthsRemaining: number
  warnLevel: WarnLevel
}

export interface AuditEntry {
  timestamp: string
  action: string
  budgetId: string
  detail: Record<string, unknown>
}

export class PredictiveBudgetPlannerV3 {
  private readonly budgets = new Map<string, Budget>()
  private readonly expenses = new Map<string, Expense[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R661.1
  registerBudget(budgetId: string, totalAmount: number, grade: DataGrade = 'O'): Budget {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (totalAmount <= 0) throw new Error('totalAmount must be positive')
    if (this.budgets.has(budgetId)) throw new Error(`Budget already exists: ${budgetId}`)
    const budget: Budget = {
      budgetId,
      totalAmount,
      grade,
      createdAt: new Date().toISOString(),
    }
    this.budgets.set(budgetId, budget)
    this.expenses.set(budgetId, [])
    this.appendAudit('budget.register', budgetId, { totalAmount })
    return { ...budget }
  }

  // Plan SC: FR-R661.2
  recordExpense(budgetId: string, timestamp: string, amount: number): Expense {
    this.requireBudget(budgetId)
    if (amount < 0) throw new Error('amount must be non-negative')
    const expense: Expense = { budgetId, timestamp, amount }
    this.expenses.get(budgetId)!.push(expense)
    return { ...expense }
  }

  // Plan SC: FR-R661.3 + FR-R661.4 + FR-R661.5
  forecast(budgetId: string): Forecast {
    const budget = this.requireBudget(budgetId)
    const expenses = this.expenses.get(budgetId)!
    const spent = expenses.reduce((s, e) => s + e.amount, 0)
    const remaining = budget.totalAmount - spent

    const monthSet = new Set<string>()
    for (const e of expenses) {
      monthSet.add(e.timestamp.substring(0, 7)) // YYYY-MM
    }
    const monthsObserved = monthSet.size
    const monthlyAverage = monthsObserved > 0 ? spent / monthsObserved : 0
    const monthsRemaining = monthlyAverage > 0 ? remaining / monthlyAverage : Infinity
    const warnLevel: WarnLevel =
      monthsRemaining <= 1 ? 'CRITICAL' : monthsRemaining <= 3 ? 'WARN' : 'OK'

    this.appendAudit('forecast', budgetId, { warnLevel, monthsRemaining })
    return {
      budgetId,
      totalAmount: budget.totalAmount,
      spent,
      remaining,
      monthsObserved,
      monthlyAverage,
      monthsRemaining,
      warnLevel,
    }
  }

  // Plan SC: FR-R661.6 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private requireBudget(budgetId: string): Budget {
    const b = this.budgets.get(budgetId)
    if (!b) throw new Error(`Unknown budget: ${budgetId}`)
    return b
  }

  private appendAudit(action: string, budgetId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, budgetId, detail })
  }
}
