/**
 * Context Budget Optimizer — SVC-AI-ADV-R155
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R155.design.md
 * Plan SC: FR-R155.1 ~ FR-R155.8
 *
 * 다수 컨텍스트 후보 중 토큰 예산 한도 내에서 우선순위가 높은 조각을 선택한다.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface ContextItem {
  id: string
  content: string
  tokens: number
  priority: number
}

export interface SelectionResult {
  selected: ContextItem[]
  dropped: string[]
  usedTokens: number
  utilization: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface OptimizerOptions {
  now?: () => number
}

export class ContextBudgetOptimizer {
  private readonly items = new Map<string, ContextItem>()
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number

  constructor(opts: OptimizerOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R155.1: 후보 등록 */
  addItem(
    id: string,
    content: string,
    tokens: number,
    priority: number,
    grade: DataGrade = 'O',
  ): void {
    this.assertGrade(grade)
    if (!id || !content || content.length === 0) {
      throw new Error('invalid_input')
    }
    if (tokens <= 0 || !Number.isFinite(tokens)) {
      throw new Error('invalid_tokens')
    }
    if (this.items.has(id)) {
      throw new Error('duplicate_item')
    }
    this.items.set(id, { id, content, tokens, priority })
    this.audit('item_added', { id, tokens, priority })
  }

  /** FR-R155.2~FR-R155.6: 예산 내 최적 선택 */
  selectWithinBudget(budget: number): SelectionResult {
    if (budget <= 0 || !Number.isFinite(budget)) {
      throw new Error('invalid_budget')
    }
    const sorted = [...this.items.values()].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      if (a.tokens !== b.tokens) return a.tokens - b.tokens
      return a.id.localeCompare(b.id)
    })

    const selected: ContextItem[] = []
    const dropped: string[] = []
    let used = 0

    for (const item of sorted) {
      if (used + item.tokens <= budget) {
        selected.push(item)
        used += item.tokens
      } else {
        dropped.push(item.id)
      }
    }

    const utilization = Math.round((used / budget) * 1e6) / 1e6
    const result: SelectionResult = {
      selected,
      dropped,
      usedTokens: used,
      utilization,
    }
    this.audit('selected', {
      budget,
      usedTokens: used,
      selectedCount: selected.length,
      droppedCount: dropped.length,
    })
    return result
  }

  /** FR-R155.7: 리셋 */
  reset(): void {
    this.items.clear()
    this.audit('reset', {})
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
