// Design Ref: §R311 — AI기반 공공기관 의사결정 지원
// Plan SC: SC-R311

export type DataGrade = 'O' | 'C' | 'S'

export interface Criterion {
  id: string
  name: string
  weight: number
}

export interface Alternative {
  altId: string
  altName: string
  scores: Record<string, number>
}

export interface Decision {
  id: string
  title: string
  criteria: Criterion[]
  alternatives: Alternative[]
}

export interface RankedAlternative {
  altId: string
  altName: string
  totalScore: number
  rank: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class DecisionSupportAI {
  private decisions = new Map<string, Decision>()
  private auditLog: AuditEntry[] = []

  registerDecision(id: string, title: string, criteria: Criterion[]): void {
    if (!id || !title) throw new Error('id와 title 필수')
    if (!Array.isArray(criteria) || criteria.length === 0) throw new Error('criteria는 비어있지 않아야 함')
    for (const c of criteria) {
      if (!c.id || !c.name) throw new Error('criterion id/name 필수')
      if (c.weight <= 0) throw new Error('weight는 양수')
    }
    this.decisions.set(id, { id, title, criteria: [...criteria], alternatives: [] })
    this.auditLog.push({ action: 'decision.register', timestamp: new Date().toISOString(), detail: id })
  }

  addAlternative(
    decisionId: string,
    altId: string,
    altName: string,
    scores: Record<string, number>,
    grade: DataGrade = 'O'
  ): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 의사결정 데이터 금지 (N2SF N-05)`)
    }
    const d = this.decisions.get(decisionId)
    if (!d) throw new Error(`decisionId 없음: ${decisionId}`)
    for (const c of d.criteria) {
      if (!(c.id in scores)) throw new Error(`criterion ${c.id} 점수 누락`)
      if ((scores[c.id] ?? 0) < 0) throw new Error('점수는 0 이상')
    }
    d.alternatives.push({ altId, altName, scores: { ...scores } })
    this.auditLog.push({ action: 'alternative.add', timestamp: new Date().toISOString(), detail: `${decisionId}:${altId}` })
  }

  rankAlternatives(decisionId: string): RankedAlternative[] {
    const d = this.decisions.get(decisionId)
    if (!d) throw new Error(`decisionId 없음: ${decisionId}`)
    const weightSum = d.criteria.reduce((a, c) => a + c.weight, 0)
    const results: RankedAlternative[] = d.alternatives.map((alt) => {
      let total = 0
      for (const c of d.criteria) {
        const normalized = c.weight / weightSum
        total += (alt.scores[c.id] ?? 0) * normalized
      }
      return {
        altId: alt.altId,
        altName: alt.altName,
        totalScore: Math.round(total * 10000) / 10000,
        rank: 0,
      }
    })
    results.sort((a, b) => b.totalScore - a.totalScore)
    results.forEach((r, i) => (r.rank = i + 1))
    return results
  }

  getBestAlternative(decisionId: string): RankedAlternative {
    const ranked = this.rankAlternatives(decisionId)
    if (ranked.length === 0) throw new Error('대안이 없습니다')
    return ranked[0]!
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
