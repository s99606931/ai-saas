// Design Ref: §핵심 알고리즘 — 감사 통과율, 미통과 필수 항목 집계
// Plan SC: SVC-AI-ADV-R379
export type DataGrade = 'O' | 'C' | 'S'

export interface AuditItem {
  id: string
  name: string
  category: string
  required: boolean
}

export interface AuditItemResult {
  itemId: string
  passed: boolean
  evidence: string
  timestamp: string
}

interface AuditLogEntry {
  action: string
  timestamp: string
  detail: string
}

export class PublicAuditAutomationV2 {
  private items = new Map<string, AuditItem>()
  private results = new Map<string, AuditItemResult>()
  private auditLog: AuditLogEntry[] = []

  registerItem(id: string, name: string, category: string, required: boolean): void {
    if (!id || !name || !category) throw new Error('id, name, category는 필수')
    this.items.set(id, { id, name, category, required })
    this.auditLog.push({ action: 'item.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordResult(itemId: string, passed: boolean, evidence: string, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 감사 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.items.has(itemId)) throw new Error(`itemId 없음: ${itemId}`)
    this.results.set(itemId, { itemId, passed, evidence, timestamp: new Date().toISOString() })
    this.auditLog.push({ action: 'result.record', timestamp: new Date().toISOString(), detail: `${itemId}:${passed}` })
  }

  getCategoryPassRate(category: string): number {
    const categoryItems = [...this.items.values()].filter((i) => i.category === category)
    if (categoryItems.length === 0) return 0
    const passedCount = categoryItems.filter((i) => this.results.get(i.id)?.passed === true).length
    return Math.round((passedCount / categoryItems.length) * 10000) / 100
  }

  getFailedRequiredItems(): AuditItem[] {
    return [...this.items.values()].filter((i) => {
      if (!i.required) return false
      const result = this.results.get(i.id)
      return !result || !result.passed
    })
  }

  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog]
  }
}
