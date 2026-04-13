// Design Ref: §R359 — AI기반 공공기관 예산 집행 분석
// Plan SC: SC-R359

export interface BudgetPlan {
  budgetId: string
  orgId: string
  orgName: string
  fiscalYear: number
  totalBudget: number
  categories: { categoryId: string; name: string; allocated: number }[]
}

export interface BudgetExecution {
  budgetId: string
  month: string
  categoryId: string
  spent: number
}

export type ExecutionStatus = 'ON_TRACK' | 'UNDERSPENT' | 'OVERSPENT' | 'AT_RISK'

export interface BudgetAnalysisReport {
  budgetId: string
  orgName: string
  totalAllocated: number
  totalSpent: number
  executionRate: number
  overallStatus: ExecutionStatus
  categoryReports: {
    categoryId: string
    name: string
    allocated: number
    spent: number
    executionRate: number
    status: ExecutionStatus
  }[]
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function computeStatus(spent: number, allocated: number): ExecutionStatus {
  const rate = allocated > 0 ? spent / allocated : 0
  if (rate > 1.0) return 'OVERSPENT'
  if (rate >= 0.9) return 'ON_TRACK'
  if (rate >= 0.5) return 'AT_RISK'
  return 'UNDERSPENT'
}

export class BudgetExecutionAnalyzerAi {
  private plans = new Map<string, BudgetPlan>()
  private executions = new Map<string, BudgetExecution[]>()
  private auditLog: AuditEntry[] = []

  registerBudget(plan: BudgetPlan): void {
    this.plans.set(plan.budgetId, plan)
    this.executions.set(plan.budgetId, [])
    this.auditLog.push({ action: 'budget.register', timestamp: new Date().toISOString(), detail: plan.budgetId })
  }

  recordExecution(execution: BudgetExecution): void {
    if (!this.plans.has(execution.budgetId)) throw new Error(`Budget not found: ${execution.budgetId}`)
    this.executions.get(execution.budgetId)!.push(execution)
    this.auditLog.push({ action: 'execution.record', timestamp: new Date().toISOString(), detail: `${execution.budgetId}:${execution.categoryId}` })
  }

  analyze(budgetId: string): BudgetAnalysisReport {
    const plan = this.plans.get(budgetId)
    if (!plan) throw new Error(`Budget not found: ${budgetId}`)

    const execs = this.executions.get(budgetId) ?? []
    const spentByCategory = new Map<string, number>()
    for (const exec of execs) {
      spentByCategory.set(exec.categoryId, (spentByCategory.get(exec.categoryId) ?? 0) + exec.spent)
    }

    const categoryReports = plan.categories.map((cat) => {
      const spent = spentByCategory.get(cat.categoryId) ?? 0
      const executionRate = cat.allocated > 0 ? Math.round((spent / cat.allocated) * 100) / 100 : 0
      return { categoryId: cat.categoryId, name: cat.name, allocated: cat.allocated, spent, executionRate, status: computeStatus(spent, cat.allocated) }
    })

    const totalSpent = categoryReports.reduce((s, r) => s + r.spent, 0)
    const executionRate = plan.totalBudget > 0 ? Math.round((totalSpent / plan.totalBudget) * 100) / 100 : 0
    const overallStatus = computeStatus(totalSpent, plan.totalBudget)

    const recommendations: string[] = []
    const overspent = categoryReports.filter((r) => r.status === 'OVERSPENT')
    const underspent = categoryReports.filter((r) => r.status === 'UNDERSPENT')
    if (overspent.length > 0) recommendations.push(`${overspent.map((r) => r.name).join(', ')} 예산 초과 — 추가경정예산 검토`)
    if (underspent.length > 0) recommendations.push(`${underspent.map((r) => r.name).join(', ')} 집행 부진 — 연내 집행 계획 수립`)

    this.auditLog.push({ action: 'budget.analyze', timestamp: new Date().toISOString(), detail: `${budgetId}:${overallStatus}` })
    return { budgetId, orgName: plan.orgName, totalAllocated: plan.totalBudget, totalSpent, executionRate, overallStatus, categoryReports, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
