// Design Ref: §R256 — AI 기반 예산 배분 최적화
// Plan SC: SVC-AI-ADV-R256-SC01

export type DataGrade = 'C' | 'S' | 'O'

export interface BudgetProject {
  projectId: string
  department: string
  requestedAmount: number
  priority: number       // 0~100
  urgency: number        // 0~100
  executionRate: number  // 0~100 (과거 집행률)
  grade?: DataGrade
}

export interface AllocationItem {
  projectId: string
  department: string
  requestedAmount: number
  allocatedAmount: number
  score: number
}

export interface AllocationResult {
  totalBudget: number
  totalAllocated: number
  items: AllocationItem[]
  unfunded: string[]     // 배분받지 못한 사업 ID
}

export interface FairnessMetrics {
  departmentTotals: Record<string, number>
  giniCoefficient: number       // 0~1
  fairnessLevel: 'FAIR' | 'MODERATE' | 'UNFAIR'
}

interface AuditEntry {
  timestamp: string
  action: string
  departmentMasked: string
  detail: Record<string, unknown>
}

export interface AllocateOptions {
  enableFairnessCorrection?: boolean
}

export class AIBudgetAllocator {
  private totalBudget = 0
  private projects = new Map<string, BudgetProject>()
  private lastResult: AllocationResult | null = null
  private auditLog: AuditEntry[] = []

  setTotalBudget(amount: number): void {
    if (amount <= 0) throw new Error('totalBudget은 0보다 커야 합니다')
    this.totalBudget = amount
    this.appendAudit('budget.set', 'SYSTEM', { amountRange: this.amountRange(amount) })
  }

  registerProject(project: BudgetProject): void {
    if (project.grade === 'C' || project.grade === 'S') {
      throw new Error(`BLOCKED: ${project.grade}등급 예산 데이터는 AI 배분 금지 (N2SF N-05)`)
    }
    if (project.grade !== 'O') {
      throw new Error('예산 사업은 O등급만 허용됩니다')
    }
    this.validateRange('priority', project.priority)
    this.validateRange('urgency', project.urgency)
    this.validateRange('executionRate', project.executionRate)
    if (project.requestedAmount < 0) {
      throw new Error('requestedAmount는 0 이상이어야 합니다')
    }
    this.projects.set(project.projectId, project)
    this.appendAudit('project.register', this.mask(project.department), {
      projectId: project.projectId,
      amountRange: this.amountRange(project.requestedAmount),
    })
  }

  calculateScore(projectId: string): number {
    const p = this.projects.get(projectId)
    if (!p) throw new Error(`Unknown project: ${projectId}`)
    return Math.round(p.priority * 0.4 + p.urgency * 0.3 + p.executionRate * 0.3)
  }

  allocate(options: AllocateOptions = {}): AllocationResult {
    if (this.totalBudget <= 0) {
      throw new Error('totalBudget을 먼저 설정해야 합니다')
    }
    const ranked = Array.from(this.projects.values())
      .map((p) => ({ project: p, score: this.calculateScore(p.projectId) }))
      .sort((a, b) => b.score - a.score)

    let remaining = this.totalBudget
    const items: AllocationItem[] = []
    const unfunded: string[] = []

    for (const { project, score } of ranked) {
      const allocated = Math.min(project.requestedAmount, remaining)
      if (allocated > 0) {
        items.push({
          projectId: project.projectId,
          department: project.department,
          requestedAmount: project.requestedAmount,
          allocatedAmount: allocated,
          score,
        })
        remaining -= allocated
      } else {
        unfunded.push(project.projectId)
      }
    }

    if (options.enableFairnessCorrection) {
      this.applyFairnessCorrection(items)
    }

    const totalAllocated = items.reduce((sum, i) => sum + i.allocatedAmount, 0)
    const result: AllocationResult = {
      totalBudget: this.totalBudget,
      totalAllocated,
      items,
      unfunded,
    }
    this.lastResult = result
    this.appendAudit('allocate', 'SYSTEM', {
      totalAllocated,
      unfundedCount: unfunded.length,
      correction: options.enableFairnessCorrection === true,
    })
    return result
  }

  getFairnessMetrics(): FairnessMetrics {
    if (!this.lastResult) {
      throw new Error('allocate()를 먼저 실행해야 합니다')
    }
    const departmentTotals: Record<string, number> = {}
    for (const item of this.lastResult.items) {
      departmentTotals[item.department] = (departmentTotals[item.department] ?? 0) + item.allocatedAmount
    }
    const values = Object.values(departmentTotals).sort((a, b) => a - b)
    const gini = this.gini(values)
    let level: 'FAIR' | 'MODERATE' | 'UNFAIR' = 'FAIR'
    if (gini >= 0.5) level = 'UNFAIR'
    else if (gini >= 0.25) level = 'MODERATE'
    return { departmentTotals, giniCoefficient: Number(gini.toFixed(4)), fairnessLevel: level }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private applyFairnessCorrection(items: AllocationItem[]): void {
    const deptTotals: Record<string, number> = {}
    for (const item of items) {
      deptTotals[item.department] = (deptTotals[item.department] ?? 0) + item.allocatedAmount
    }
    const deptKeys = Object.keys(deptTotals)
    if (deptKeys.length < 2) return
    const avg = Object.values(deptTotals).reduce((a, b) => a + b, 0) / deptKeys.length
    const threshold = avg * 2

    for (const dept of deptKeys) {
      const total = deptTotals[dept] ?? 0
      if (total > threshold) {
        // 해당 부서 상위 10% 차감
        const deptItems = items.filter((i) => i.department === dept).sort((a, b) => b.allocatedAmount - a.allocatedAmount)
        for (const di of deptItems) {
          const deduction = Math.floor(di.allocatedAmount * 0.1)
          di.allocatedAmount -= deduction
        }
      }
    }
  }

  private gini(values: number[]): number {
    const n = values.length
    if (n === 0) return 0
    const total = values.reduce((a, b) => a + b, 0)
    if (total === 0) return 0
    let cumSum = 0
    let cumProduct = 0
    for (let i = 0; i < n; i++) {
      cumSum += values[i] ?? 0
      cumProduct += cumSum
    }
    return (n + 1 - 2 * (cumProduct / total)) / n
  }

  private validateRange(name: string, value: number): void {
    if (value < 0 || value > 100) {
      throw new Error(`${name}는 0~100 범위여야 합니다`)
    }
  }

  private mask(id: string): string {
    if (id.length <= 2) return '***'
    return `${id.slice(0, 1)}***${id.slice(-1)}`
  }

  private amountRange(amount: number): string {
    if (amount < 10_000_000) return '<1000만'
    if (amount < 100_000_000) return '<1억'
    if (amount < 1_000_000_000) return '<10억'
    return '>=10억'
  }

  private appendAudit(action: string, departmentMasked: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      departmentMasked,
      detail,
    })
  }
}
