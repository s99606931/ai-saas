// Design Ref: §핵심 알고리즘 — 가중 합산 점수, 최우선 대안 추천
// Plan SC: SVC-AI-ADV-R376
export type DataGrade = 'O' | 'C' | 'S'

export interface Criterion {
  id: string
  name: string
  weight: number
}

export interface Alternative {
  id: string
  name: string
  scores: Record<string, number>
}

export interface AlternativeResult {
  alternativeId: string
  name: string
  totalScore: number
  rank: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class DecisionSupportSystemAI {
  private criteria = new Map<string, Criterion>()
  private alternatives = new Map<string, Alternative>()
  private auditLog: AuditEntry[] = []

  registerCriterion(id: string, name: string, weight: number): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    if (weight <= 0) throw new Error('weight는 양수여야 합니다')
    this.criteria.set(id, { id, name, weight })
    this.auditLog.push({ action: 'criterion.register', timestamp: new Date().toISOString(), detail: id })
  }

  registerAlternative(id: string, name: string, scores: Record<string, number>): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    this.alternatives.set(id, { id, name, scores })
    this.auditLog.push({ action: 'alternative.register', timestamp: new Date().toISOString(), detail: id })
  }

  evaluateAlternatives(grade: DataGrade = 'O'): AlternativeResult[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 의사결정 데이터 전송 금지 (N2SF N-05)`)
    }
    const criteriaList = [...this.criteria.values()]
    const weightSum = criteriaList.reduce((s, c) => s + c.weight, 0)
    if (weightSum === 0) return []

    const results: AlternativeResult[] = []
    for (const alt of this.alternatives.values()) {
      const totalScore = Math.round(
        criteriaList.reduce((s, c) => s + (alt.scores[c.id] ?? 0) * (c.weight / weightSum), 0) * 100
      ) / 100
      results.push({ alternativeId: alt.id, name: alt.name, totalScore, rank: 0 })
    }
    results.sort((a, b) => b.totalScore - a.totalScore)
    results.forEach((r, i) => { r.rank = i + 1 })
    this.auditLog.push({ action: 'alternatives.evaluate', timestamp: new Date().toISOString(), detail: `count=${results.length}` })
    return results
  }

  getBestAlternative(grade: DataGrade = 'O'): AlternativeResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 의사결정 데이터 전송 금지 (N2SF N-05)`)
    }
    const results = this.evaluateAlternatives(grade)
    if (results.length === 0) throw new Error('등록된 대안이 없습니다')
    return results[0]!
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
