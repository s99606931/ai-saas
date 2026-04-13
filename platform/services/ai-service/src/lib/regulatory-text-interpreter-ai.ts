// Design Ref: §핵심 알고리즘 — 의무/금지 조항 분류
// Plan SC: SVC-AI-ADV-R404
export type DataGrade = 'O' | 'C' | 'S'

export interface RegulationEntry {
  id: string
  title: string
  content: string
  category: string
  clauseType: 'mandatory' | 'prohibited' | 'neutral'
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function classifyClause(content: string): 'mandatory' | 'prohibited' | 'neutral' {
  if (content.includes('해야') || content.includes('하여야')) return 'mandatory'
  if (content.includes('금지') || content.includes('하면 안')) return 'prohibited'
  return 'neutral'
}

export class RegulatoryTextInterpreterAI {
  private regulations = new Map<string, RegulationEntry>()
  private auditLog: AuditEntry[] = []

  registerRegulation(id: string, title: string, content: string, category: string, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 규정 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!id || !title || !content || !category) throw new Error('id, title, content, category는 필수')
    const clauseType = classifyClause(content)
    this.regulations.set(id, { id, title, content, category, clauseType })
    this.auditLog.push({ action: 'regulation.register', timestamp: new Date().toISOString(), detail: `${id}:${clauseType}` })
  }

  getMandatoryClauses(): RegulationEntry[] {
    return [...this.regulations.values()].filter((r) => r.clauseType === 'mandatory')
  }

  getProhibitedClauses(): RegulationEntry[] {
    return [...this.regulations.values()].filter((r) => r.clauseType === 'prohibited')
  }

  getByCategory(category: string): RegulationEntry[] {
    return [...this.regulations.values()].filter((r) => r.category === category)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
