// Design Ref: §핵심 알고리즘 — 품질 점수 계산, 결함 유형별 집계
// Plan SC: SVC-AI-ADV-R381
export type DataGrade = 'O' | 'C' | 'S'
export type DefectSeverity = 'critical' | 'high' | 'medium' | 'low'

const DEFECT_DEDUCTION: Record<DefectSeverity, number> = { critical: 30, high: 15, medium: 7, low: 2 }

export interface CodeSnippet {
  id: string
  language: string
  linesOfCode: number
}

export interface DefectEntry {
  snippetId: string
  defectType: string
  severity: DefectSeverity
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class CodeGenerationQualityVerifier {
  private snippets = new Map<string, CodeSnippet>()
  private defects = new Map<string, DefectEntry[]>()
  private auditLog: AuditEntry[] = []

  registerSnippet(id: string, language: string, linesOfCode: number): void {
    if (!id || !language) throw new Error('id와 language는 필수')
    this.snippets.set(id, { id, language, linesOfCode })
    this.defects.set(id, [])
    this.auditLog.push({ action: 'snippet.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordDefect(snippetId: string, defectType: string, severity: DefectSeverity, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 코드 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.snippets.has(snippetId)) throw new Error(`snippetId 없음: ${snippetId}`)
    this.defects.get(snippetId)!.push({ snippetId, defectType, severity })
    this.auditLog.push({ action: 'defect.record', timestamp: new Date().toISOString(), detail: `${snippetId}:${defectType}:${severity}` })
  }

  getQualityScore(snippetId: string): number {
    if (!this.snippets.has(snippetId)) throw new Error(`snippetId 없음: ${snippetId}`)
    const defectList = this.defects.get(snippetId) ?? []
    const totalDeduction = defectList.reduce((s, d) => s + DEFECT_DEDUCTION[d.severity], 0)
    return Math.max(0, 100 - totalDeduction)
  }

  getDefectSummary(snippetId: string): Record<string, number> {
    if (!this.snippets.has(snippetId)) throw new Error(`snippetId 없음: ${snippetId}`)
    const summary: Record<string, number> = {}
    for (const d of this.defects.get(snippetId) ?? []) {
      summary[d.defectType] = (summary[d.defectType] ?? 0) + 1
    }
    return summary
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
