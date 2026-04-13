// Design Ref: §핵심 알고리즘 — Stale 탐지, 상태 갱신
// Plan SC: SVC-AI-ADV-R340
export type DataGrade = 'O' | 'C' | 'S'

export interface CatalogEntry {
  id: string
  name: string
  category: string
  status: string
  lastUpdated: number
  staleTtlMs: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServiceCatalogAutoRefresher {
  private entries = new Map<string, CatalogEntry>()
  private auditLog: AuditEntry[] = []

  registerEntry(id: string, name: string, category: string, staleTtlMs: number): void {
    if (!id || !name || !category) throw new Error('id, name, category는 필수')
    if (staleTtlMs <= 0) throw new Error('staleTtlMs는 양수여야 합니다')
    this.entries.set(id, { id, name, category, status: 'active', lastUpdated: Date.now(), staleTtlMs })
    this.auditLog.push({ action: 'entry.register', timestamp: new Date().toISOString(), detail: id })
  }

  updateEntry(entryId: string, status: string, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 카탈로그 데이터 갱신 금지 (N2SF N-05)`)
    }
    const entry = this.entries.get(entryId)
    if (!entry) throw new Error(`entryId 없음: ${entryId}`)
    entry.status = status
    entry.lastUpdated = Date.now()
    this.auditLog.push({ action: 'entry.update', timestamp: new Date().toISOString(), detail: `${entryId}:${status}` })
  }

  getStaleEntries(): CatalogEntry[] {
    const now = Date.now()
    return [...this.entries.values()].filter((e) => now - e.lastUpdated > e.staleTtlMs)
  }

  getCatalog(): CatalogEntry[] {
    return [...this.entries.values()]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
