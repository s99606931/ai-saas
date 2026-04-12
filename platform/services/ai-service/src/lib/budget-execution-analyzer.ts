// Design Ref: §R194 — AI기반 예산 집행 패턴 분석
// Plan SC: SVC-AI-ADV-R194-SC01

export interface BudgetItem {
  itemId: string
  department: string
  name: string
  annualBudget: number
  fiscalYear: number
}

export interface ExecutionRecord {
  itemId: string
  month: number  // 1~12
  amount: number
  category: 'PERSONNEL' | 'OPERATIONS' | 'CAPITAL' | 'TRANSFER'
  description: string
}

export type PatternType = 'FRONT_LOADED' | 'BACK_LOADED' | 'EVEN' | 'IRREGULAR'

export interface ExecutionAnalysis {
  itemId: string
  totalSpent: number
  executionRate: number
  monthlyDistribution: number[]  // 12 months
  pattern: PatternType
  bottleneckMonths: number[]
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  itemId: string
  detail: Record<string, unknown>
}

export class BudgetExecutionAnalyzer {
  private items = new Map<string, BudgetItem>()
  private records = new Map<string, ExecutionRecord[]>()
  private auditLog: AuditEntry[] = []

  registerItem(item: BudgetItem): void {
    this.items.set(item.itemId, item)
    this.records.set(item.itemId, [])
    this.appendAudit('item.register', item.itemId, { department: item.department })
  }

  recordExecution(record: ExecutionRecord): void {
    if (!this.items.has(record.itemId)) throw new Error(`Unknown item: ${record.itemId}`)
    if (record.month < 1 || record.month > 12) throw new Error('월은 1~12 범위여야 합니다')
    const list = this.records.get(record.itemId) ?? []
    list.push(record)
    this.records.set(record.itemId, list)
    this.appendAudit('execution.record', record.itemId, { month: record.month, amount: record.amount })
  }

  analyze(itemId: string): ExecutionAnalysis {
    const item = this.items.get(itemId)
    if (!item) throw new Error(`Unknown item: ${itemId}`)

    const executions = this.records.get(itemId) ?? []
    const totalSpent = executions.reduce((sum, r) => sum + r.amount, 0)
    const executionRate = item.annualBudget > 0 ? totalSpent / item.annualBudget : 0

    const monthlyDistribution = Array(12).fill(0) as number[]
    for (const rec of executions) {
      monthlyDistribution[rec.month - 1] = (monthlyDistribution[rec.month - 1] ?? 0) + rec.amount
    }

    const pattern = this.detectPattern(monthlyDistribution, totalSpent)
    const bottleneckMonths = this.findBottlenecks(monthlyDistribution)
    const recommendation = this.buildRecommendation(pattern, executionRate, bottleneckMonths)

    this.appendAudit('analysis.complete', itemId, { pattern, executionRate })

    return { itemId, totalSpent, executionRate, monthlyDistribution, pattern, bottleneckMonths, recommendation }
  }

  private detectPattern(monthly: number[], total: number): PatternType {
    if (total === 0) return 'EVEN'
    const firstHalf = monthly.slice(0, 6).reduce((a, b) => a + b, 0)
    const firstRatio = firstHalf / total
    const nonZeroMonths = monthly.filter((m) => m > 0).length

    if (firstRatio >= 0.7) return 'FRONT_LOADED'
    if (firstRatio <= 0.3) return 'BACK_LOADED'
    if (nonZeroMonths <= 3) return 'IRREGULAR'
    return 'EVEN'
  }

  private findBottlenecks(monthly: number[]): number[] {
    const total = monthly.reduce((a, b) => a + b, 0)
    if (total === 0) return []
    const mean = total / monthly.length
    const bottlenecks: number[] = []
    for (let i = 0; i < monthly.length; i++) {
      if ((monthly[i] ?? 0) > mean * 2) {
        bottlenecks.push(i + 1)
      }
    }
    return bottlenecks
  }

  private buildRecommendation(pattern: PatternType, rate: number, bottlenecks: number[]): string {
    if (rate < 0.5) return '집행률이 50% 미만입니다. 조기 집행 계획 수립이 필요합니다.'
    if (pattern === 'BACK_LOADED') return '연말 집중 집행 패턴이 감지되었습니다. 분기별 균등 집행을 권장합니다.'
    if (pattern === 'FRONT_LOADED') return '상반기 집중 집행 패턴입니다. 하반기 예산 배분 계획을 검토하십시오.'
    if (bottlenecks.length > 0) return `${bottlenecks.join(', ')}월에 집중 지출이 발생하였습니다. 평준화 집행을 권장합니다.`
    return '정상적인 집행 패턴입니다.'
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, itemId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, itemId, detail })
  }
}
