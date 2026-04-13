// Design Ref: §R501 — AI 예산 집행 모니터링
// Plan SC: SVC-AI-ADV-R501-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type ExecutionStatus = 'NORMAL' | 'UNDER_EXECUTED' | 'OVER_EXECUTED' | 'CRITICAL'

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export interface BudgetItem {
  itemId: string
  category: string
  allocated: number
  fiscalYear: number
}

export interface ExecutionRecord {
  itemId: string
  period: string
  executed: number
}

export interface ExecutionEvaluation {
  itemId: string
  category: string
  allocated: number
  executedTotal: number
  executionRate: number
  status: ExecutionStatus
  remaining: number
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class AiBudgetExecutionMonitor {
  private readonly items = new Map<string, BudgetItem>()
  private readonly executions = new Map<string, ExecutionRecord[]>()
  private readonly auditLog: AuditEntry[] = []

  registerItem(item: BudgetItem, grade: DataGrade): void {
    blockClassifiedData(grade)
    if (!item.itemId) throw new Error('itemId 필수')
    if (item.allocated <= 0) throw new Error('allocated는 양수')
    if (this.items.has(item.itemId)) throw new Error(`중복 itemId: ${item.itemId}`)
    this.items.set(item.itemId, { ...item })
    this.executions.set(item.itemId, [])
    this.appendAudit('item.register', { itemId: item.itemId, allocated: item.allocated })
  }

  recordExecution(record: ExecutionRecord, grade: DataGrade): void {
    blockClassifiedData(grade)
    if (!this.items.has(record.itemId)) throw new Error(`itemId 없음: ${record.itemId}`)
    if (record.executed < 0) throw new Error('executed는 0 이상')
    const list = this.executions.get(record.itemId) ?? []
    list.push({ ...record })
    this.executions.set(record.itemId, list)
    this.appendAudit('execution.record', { itemId: record.itemId, executed: record.executed })
  }

  evaluate(itemId: string): ExecutionEvaluation {
    const item = this.items.get(itemId)
    if (!item) throw new Error(`itemId 없음: ${itemId}`)
    const list = this.executions.get(itemId) ?? []
    const executedTotal = list.reduce((s, r) => s + r.executed, 0)
    const executionRate = Math.round((executedTotal / item.allocated) * 1000) / 10
    const status = this.determineStatus(executionRate)
    const remaining = item.allocated - executedTotal
    const recommendation = this.recommend(status)
    this.appendAudit('item.evaluate', { itemId, executionRate, status })
    return {
      itemId,
      category: item.category,
      allocated: item.allocated,
      executedTotal,
      executionRate,
      status,
      remaining,
      recommendation,
    }
  }

  listItems(): string[] {
    return [...this.items.keys()]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private determineStatus(rate: number): ExecutionStatus {
    if (rate > 110) return 'CRITICAL'
    if (rate > 100) return 'OVER_EXECUTED'
    if (rate < 50) return 'UNDER_EXECUTED'
    return 'NORMAL'
  }

  private recommend(status: ExecutionStatus): string {
    switch (status) {
      case 'CRITICAL':
        return '즉시 집행 중단 및 추경 검토'
      case 'OVER_EXECUTED':
        return '추경 또는 전용 검토'
      case 'UNDER_EXECUTED':
        return '집행 촉진 또는 불용 처리'
      default:
        return '정상 집행 중'
    }
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
