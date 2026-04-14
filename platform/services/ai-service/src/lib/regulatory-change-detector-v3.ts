// Design Ref: §설계 결정 — 조문 diff 및 영향도 판정
// Plan SC: SVC-AI-ADV-R615
export type DataGrade = 'O' | 'C' | 'S'

export interface RegulationSnapshot {
  id: string
  clauses: Map<string, string>
}

export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface ChangeDiff {
  fromId: string
  toId: string
  added: string[]
  removed: string[]
  modified: string[]
  impact: ImpactLevel
}

export interface AuditEntry {
  timestamp: string
  action: string
  details?: Record<string, unknown>
}

const HIGH_RISK_KEYWORDS = ['필수', '금지', '제재', '처벌', '의무']

export class RegulatoryChangeDetectorV3 {
  private snapshots = new Map<string, RegulationSnapshot>()
  private auditLog: AuditEntry[] = []

  registerSnapshot(id: string, clauses: Record<string, string>, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!id) throw new Error('id는 필수')
    const map = new Map<string, string>(Object.entries(clauses))
    this.snapshots.set(id, { id, clauses: map })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'snapshot.register',
      details: { id, count: map.size },
    })
  }

  diff(fromId: string, toId: string): ChangeDiff {
    const from = this.snapshots.get(fromId)
    const to = this.snapshots.get(toId)
    if (!from || !to) throw new Error(`스냅샷 없음: ${fromId} 또는 ${toId}`)
    const added: string[] = []
    const removed: string[] = []
    const modified: string[] = []
    for (const [k, v] of to.clauses.entries()) {
      if (!from.clauses.has(k)) added.push(k)
      else if (from.clauses.get(k) !== v) modified.push(k)
    }
    for (const k of from.clauses.keys()) {
      if (!to.clauses.has(k)) removed.push(k)
    }

    let impact: ImpactLevel = 'LOW'
    if (modified.length > 5 || removed.length > 3) impact = 'HIGH'
    else if (added.length + modified.length + removed.length > 0) impact = 'MEDIUM'

    // 고위험 키워드 검사
    const toCheck = [...added, ...modified]
    for (const k of toCheck) {
      const text = to.clauses.get(k) || ''
      if (HIGH_RISK_KEYWORDS.some((kw) => text.includes(kw))) {
        impact = 'HIGH'
        break
      }
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'diff.compute',
      details: { fromId, toId, impact },
    })
    return { fromId, toId, added, removed, modified, impact }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
