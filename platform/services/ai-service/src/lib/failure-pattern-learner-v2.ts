// Design Ref: §클래스 설계 — FailurePatternLearnerV2
// Plan SC: SVC-AI-ADV-R535

interface FailurePattern {
  patternId: string
  name: string
  indicators: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  patternId: string
  details?: Record<string, unknown>
}

export class FailurePatternLearnerV2 {
  private patterns = new Map<string, FailurePattern>()
  private frequencies = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerPattern(patternId: string, name: string, indicators: string[]): FailurePattern {
    const pattern: FailurePattern = { patternId, name, indicators }
    this.patterns.set(patternId, pattern)
    this.frequencies.set(patternId, 0)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_PATTERN', patternId, details: { name, indicatorCount: indicators.length } })
    return pattern
  }

  recordOccurrence(patternId: string, serviceId: string, severity: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.patterns.has(patternId)) throw new Error(`패턴을 찾을 수 없습니다: ${patternId}`)
    this.frequencies.set(patternId, (this.frequencies.get(patternId) ?? 0) + 1)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_OCCURRENCE', patternId, details: { serviceId, severity } })
  }

  getPatternFrequency(patternId: string): number {
    return this.frequencies.get(patternId) ?? 0
  }

  getHighFrequencyPatterns(threshold: number): FailurePattern[] {
    return Array.from(this.patterns.values()).filter(p => this.getPatternFrequency(p.patternId) >= threshold)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
