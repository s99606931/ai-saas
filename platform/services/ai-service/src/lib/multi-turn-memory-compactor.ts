/**
 * Multi-Turn Memory Compactor — SVC-AI-ADV-R153
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R153.design.md
 * Plan SC: FR-R153.1 ~ FR-R153.9
 *
 * 다중 턴 대화 메모리를 토큰 예산 한도 내에서 자동 압축 · 요약한다.
 */

export type Role = 'system' | 'user' | 'assistant'
export type DataGrade = 'O' | 'C' | 'S'

export interface Turn {
  role: Role
  content: string
  tokens: number
  pinned: boolean
  summary?: boolean
}

export interface AppendOpts {
  pinned?: boolean
  tokens?: number
  grade?: DataGrade
}

export interface CompactResult {
  compacted: boolean
  before: number
  after: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface CompactorOptions {
  /** 압축 시 보존할 최근 비고정 턴 수 (기본 2) */
  keepRecent?: number
  now?: () => number
}

export class MultiTurnMemoryCompactor {
  private readonly turns: Turn[] = []
  private readonly auditLog: AuditEntry[] = []
  private readonly keepRecent: number
  private readonly now: () => number

  constructor(opts: CompactorOptions = {}) {
    this.keepRecent = opts.keepRecent ?? 2
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R153.1: 턴 추가 */
  appendTurn(role: Role, content: string, opts: AppendOpts = {}): void {
    this.assertGrade(opts.grade ?? 'O')
    if (!content || content.trim().length === 0) {
      throw new Error('invalid_input')
    }
    const tokens = opts.tokens ?? this.estimateTokens(content)
    this.turns.push({
      role,
      content,
      tokens,
      pinned: opts.pinned ?? false,
    })
    this.audit('turn_appended', { role, tokens, pinned: opts.pinned ?? false })
  }

  /** FR-R153.3: 전체 토큰 합 */
  totalTokens(): number {
    return this.turns.reduce((sum, t) => sum + t.tokens, 0)
  }

  /** FR-R153.4~FR-R153.7: 필요 시 압축 */
  compactIfNeeded(budget: number): CompactResult {
    if (budget <= 0) {
      throw new Error('invalid_budget')
    }
    const before = this.totalTokens()
    if (before <= budget) {
      this.audit('compact_skip', { before, budget })
      return { compacted: false, before, after: before }
    }

    // 1) 요약 가능한 head 식별
    const tail = this.pickTail()
    const tailSet = new Set(tail)
    const head = this.turns.filter((t) => !tailSet.has(t) && !t.pinned && !t.summary)

    if (head.length >= 2) {
      const summaryTurn = this.buildSummaryTurn(head)
      // head 제거 후 summaryTurn을 맨 앞의 head 자리에 삽입
      const pinnedAndSummaries = this.turns.filter((t) => t.pinned || t.summary)
      const rebuilt: Turn[] = []
      // 원래 순서를 유지하며: pinned/summary + summaryTurn + tail
      // 간단화: pinned/summary는 index로 정렬, summary는 맨 앞 head 자리에 넣음
      let summaryInserted = false
      for (const t of this.turns) {
        if (tailSet.has(t)) continue
        if (t.pinned || t.summary) {
          rebuilt.push(t)
          continue
        }
        if (!summaryInserted) {
          rebuilt.push(summaryTurn)
          summaryInserted = true
        }
        // 일반 head 턴은 폐기
      }
      if (!summaryInserted) {
        rebuilt.push(summaryTurn)
      }
      // tail 추가 (원래 상대 순서 보존)
      for (const t of tail) rebuilt.push(t)
      this.turns.splice(0, this.turns.length, ...rebuilt)
      // 미사용 변수 방지
      void pinnedAndSummaries
    }

    // 2) 여전히 초과 시:
    //    - 요약 턴부터 제거 (요약은 최후 보루가 아님 — 일반 턴 원본이 더 중요)
    //    - 그래도 부족하면 가장 오래된 non-pinned 턴 제거 (단, 최근 keepRecent 개는 보존)
    while (this.totalTokens() > budget) {
      const summaryIdx = this.turns.findIndex((t) => t.summary)
      if (summaryIdx !== -1) {
        this.turns.splice(summaryIdx, 1)
        continue
      }
      // 최근 keepRecent개 비고정 턴의 인덱스를 수집 (보존 대상)
      const preservedIdx = new Set<number>()
      let kept = 0
      for (let i = this.turns.length - 1; i >= 0; i -= 1) {
        const turn = this.turns[i]
        if (!turn) continue
        if (turn.pinned) {
          preservedIdx.add(i)
          continue
        }
        if (kept < this.keepRecent) {
          preservedIdx.add(i)
          kept += 1
        }
      }
      const victim = this.turns.findIndex(
        (t, i) => !t.pinned && !t.summary && !preservedIdx.has(i),
      )
      if (victim === -1) break
      this.turns.splice(victim, 1)
    }

    const after = this.totalTokens()
    this.audit('compact_done', { before, after, budget })
    return { compacted: true, before, after }
  }

  /** FR-R153.8: 압축된 이력 반환 */
  getCompactedHistory(): Turn[] {
    return this.turns.map((t) => ({ ...t }))
  }

  /** FR-R153.9: 리셋 */
  reset(): void {
    this.turns.splice(0, this.turns.length)
    this.audit('reset', {})
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private estimateTokens(text: string): number {
    const parts = text.trim().split(/\s+/).filter(Boolean)
    return parts.length
  }

  private pickTail(): Turn[] {
    // 최근 keepRecent개의 non-pinned 턴 + 모든 pinned 턴
    const result: Turn[] = []
    let kept = 0
    for (let i = this.turns.length - 1; i >= 0; i -= 1) {
      const turn = this.turns[i]
      if (!turn) continue
      if (turn.pinned) {
        result.unshift(turn)
        continue
      }
      if (kept < this.keepRecent) {
        result.unshift(turn)
        kept += 1
      }
    }
    return result
  }

  private buildSummaryTurn(head: Turn[]): Turn {
    const topics = head
      .map((t) => this.firstKeywords(t.content))
      .filter((w) => w.length > 0)
      .slice(0, 5)
      .join(',')
    const content = `[SUMMARY: ${head.length} turns, topics=${topics}]`
    return {
      role: 'system',
      content,
      tokens: this.estimateTokens(content),
      pinned: false,
      summary: true,
    }
  }

  private firstKeywords(text: string): string {
    const tokens = text.trim().split(/\s+/).filter(Boolean)
    return tokens[0] ?? ''
  }

  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
