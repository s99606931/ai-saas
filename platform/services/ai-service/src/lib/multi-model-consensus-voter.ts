/**
 * Multi-Model Consensus Voter — SVC-AI-ADV-R129
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R129.design.md
 * Plan SC: FR-R129.1 ~ FR-R129.7
 *
 * 복수 LLM 응답 3전략(majority/weighted/ranked) 앙상블 투표.
 * 결정적 정규화 + tiebreaker.
 * CSAP D-06 감사, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export type VoteStrategy = 'majority' | 'weighted' | 'ranked'

export interface ModelResponse {
  modelId: string
  answer: string
  confidence?: number
}

export interface ConsensusResult {
  winner: string
  strategy: VoteStrategy
  support: number
  totalVotes: number
  tiebreaker?: string
  distribution: { answer: string; count: number; weight: number }[]
  timestamp: number
}

export interface VoteAuditEntry {
  action: 'modelRegistered' | 'voteConducted' | 'tiebreakerApplied'
  strategy?: VoteStrategy
  winner?: string
  timestamp: number
  details: Record<string, unknown>
}

export class MultiModelConsensusVoter {
  private readonly weights = new Map<string, number>()
  private readonly auditLog: VoteAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 Multi-Model Consensus Voter 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R129.1 */
  registerModel(modelId: string, weight = 1): void {
    if (!modelId.trim()) {
      throw new Error('modelId must not be empty')
    }
    if (weight <= 0 || !Number.isFinite(weight)) {
      throw new Error('weight must be positive finite number')
    }
    this.weights.set(modelId, weight)
    this.audit({
      action: 'modelRegistered',
      timestamp: Date.now(),
      details: { modelId, weight },
    })
  }

  /** FR-R129.6 */
  decide(
    strategy: VoteStrategy,
    responses: ModelResponse[],
    rankings?: string[][],
  ): ConsensusResult {
    if (responses.length === 0) {
      throw new Error('responses must not be empty')
    }
    const normalized = responses.map((r) => ({
      modelId: r.modelId,
      answer: this.normalize(r.answer),
      confidence: r.confidence ?? 1,
    }))
    for (const r of normalized) {
      if (r.answer === '') {
        throw new Error('normalized answer must not be empty')
      }
    }

    let result: ConsensusResult
    switch (strategy) {
      case 'majority':
        result = this.voteMajority(normalized)
        break
      case 'weighted':
        result = this.voteWeighted(normalized)
        break
      case 'ranked':
        result = this.voteRanked(normalized, rankings)
        break
      default:
        throw new Error(`unknown strategy: ${strategy as string}`)
    }

    this.audit({
      action: 'voteConducted',
      strategy,
      winner: result.winner,
      timestamp: Date.now(),
      details: { support: result.support, total: result.totalVotes },
    })

    return result
  }

  /** FR-R129.7 */
  getAuditLog(): VoteAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private normalize(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ')
  }

  private voteMajority(
    responses: Array<{ modelId: string; answer: string; confidence: number }>,
  ): ConsensusResult {
    const counts = new Map<string, number>()
    const firstSeen = new Map<string, number>()
    responses.forEach((r, idx) => {
      counts.set(r.answer, (counts.get(r.answer) ?? 0) + 1)
      if (!firstSeen.has(r.answer)) firstSeen.set(r.answer, idx)
    })

    const sorted = [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return (firstSeen.get(a[0]) ?? 0) - (firstSeen.get(b[0]) ?? 0)
    })

    const top = sorted[0]
    if (!top) throw new Error('vote result empty')

    let tiebreaker: string | undefined
    if (sorted.length > 1) {
      const second = sorted[1]
      if (second && second[1] === top[1]) {
        tiebreaker = 'first-seen-order'
        this.audit({
          action: 'tiebreakerApplied',
          strategy: 'majority',
          winner: top[0],
          timestamp: Date.now(),
          details: { tied: sorted.filter((e) => e[1] === top[1]).length },
        })
      }
    }

    return {
      winner: top[0],
      strategy: 'majority',
      support: top[1],
      totalVotes: responses.length,
      tiebreaker,
      distribution: sorted.map(([answer, count]) => ({
        answer,
        count,
        weight: count,
      })),
      timestamp: Date.now(),
    }
  }

  private voteWeighted(
    responses: Array<{ modelId: string; answer: string; confidence: number }>,
  ): ConsensusResult {
    const weighted = new Map<string, { count: number; weight: number; firstIdx: number }>()
    responses.forEach((r, idx) => {
      const w = this.weights.get(r.modelId) ?? 1
      const existing = weighted.get(r.answer)
      if (existing) {
        existing.count += 1
        existing.weight += w
      } else {
        weighted.set(r.answer, { count: 1, weight: w, firstIdx: idx })
      }
    })

    const sorted = [...weighted.entries()].sort((a, b) => {
      if (b[1].weight !== a[1].weight) return b[1].weight - a[1].weight
      return a[1].firstIdx - b[1].firstIdx
    })

    const top = sorted[0]
    if (!top) throw new Error('weighted vote empty')

    let tiebreaker: string | undefined
    if (sorted.length > 1) {
      const second = sorted[1]
      if (second && second[1].weight === top[1].weight) {
        tiebreaker = 'first-seen-order'
        this.audit({
          action: 'tiebreakerApplied',
          strategy: 'weighted',
          winner: top[0],
          timestamp: Date.now(),
          details: { tiedWeight: top[1].weight },
        })
      }
    }

    return {
      winner: top[0],
      strategy: 'weighted',
      support: top[1].weight,
      totalVotes: responses.length,
      tiebreaker,
      distribution: sorted.map(([answer, info]) => ({
        answer,
        count: info.count,
        weight: info.weight,
      })),
      timestamp: Date.now(),
    }
  }

  private voteRanked(
    responses: Array<{ modelId: string; answer: string; confidence: number }>,
    rankings?: string[][],
  ): ConsensusResult {
    const firstIdx = new Map<string, number>()
    responses.forEach((r, idx) => {
      if (!firstIdx.has(r.answer)) firstIdx.set(r.answer, idx)
    })

    const normalizedRankings: string[][] =
      rankings && rankings.length === responses.length
        ? rankings.map((row) => row.map((a) => this.normalize(a)).filter((a) => a !== ''))
        : responses.map((r) => [r.answer])

    const workingRankings: string[][] = normalizedRankings.map((row) => [...row])
    const eliminated = new Set<string>()
    const allAnswers = new Set<string>(
      workingRankings.flatMap((row) => row),
    )

    let winner: string | null = null
    let tiebreaker: string | undefined

    while (winner === null) {
      const topCounts = new Map<string, number>()
      for (const row of workingRankings) {
        const top = row.find((a) => !eliminated.has(a))
        if (top) topCounts.set(top, (topCounts.get(top) ?? 0) + 1)
      }

      if (topCounts.size === 0) {
        // 모두 소진 — 첫 기록 answer 선택
        const first = responses[0]
        if (!first) throw new Error('no responses')
        winner = first.answer
        tiebreaker = 'fallback-first-response'
        break
      }

      const total = [...topCounts.values()].reduce((a, b) => a + b, 0)
      const sorted = [...topCounts.entries()].sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        return (firstIdx.get(a[0]) ?? 0) - (firstIdx.get(b[0]) ?? 0)
      })

      const top = sorted[0]
      if (!top) break

      if (top[1] * 2 > total) {
        winner = top[0]
        break
      }

      // 과반 미달 → 최소 득표 탈락
      const minCount = sorted[sorted.length - 1]?.[1] ?? 0
      const losers = sorted.filter((e) => e[1] === minCount).map((e) => e[0])

      if (losers.length === topCounts.size) {
        // 모두 동률 — 사전순 1개 제외 나머지 탈락
        losers.sort()
        const survivor = losers[0]
        for (const l of losers) {
          if (l !== survivor) eliminated.add(l)
        }
        tiebreaker = 'alphabetical-survivor'
        this.audit({
          action: 'tiebreakerApplied',
          strategy: 'ranked',
          timestamp: Date.now(),
          details: { losers, survivor },
        })
        winner = survivor ?? null
        break
      }

      for (const l of losers) eliminated.add(l)
    }

    if (winner === null) {
      const first = responses[0]
      winner = first ? first.answer : ''
      tiebreaker = 'fallback-first-response'
    }

    // 분포 계산 (최종 1순위 카운트)
    const finalCounts = new Map<string, number>()
    for (const row of workingRankings) {
      const top = row.find((a) => !eliminated.has(a)) ?? row[0]
      if (top) finalCounts.set(top, (finalCounts.get(top) ?? 0) + 1)
    }
    for (const a of allAnswers) {
      if (!finalCounts.has(a)) finalCounts.set(a, 0)
    }

    const distribution = [...finalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([answer, count]) => ({ answer, count, weight: count }))

    return {
      winner,
      strategy: 'ranked',
      support: finalCounts.get(winner) ?? 0,
      totalVotes: responses.length,
      tiebreaker,
      distribution,
      timestamp: Date.now(),
    }
  }

  private audit(entry: VoteAuditEntry): void {
    this.auditLog.push(entry)
  }
}
