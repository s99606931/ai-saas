// Design Ref: §등급 기준 — CodeComplexityAnalyzerV2
// Plan SC: SVC-AI-ADV-R530

type ComplexityGrade = 'high' | 'medium' | 'low'

interface CodeModule {
  moduleId: string
  name: string
  language: string
}

interface ComplexityMetric {
  cyclomaticComplexity: number
  linesOfCode: number
}

interface AuditEntry {
  timestamp: string
  action: string
  moduleId: string
  details?: Record<string, unknown>
}

export class CodeComplexityAnalyzerV2 {
  private modules = new Map<string, CodeModule>()
  private metrics = new Map<string, ComplexityMetric>()
  private auditLog: AuditEntry[] = []

  registerModule(moduleId: string, name: string, language: string): CodeModule {
    const mod: CodeModule = { moduleId, name, language }
    this.modules.set(moduleId, mod)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_MODULE', moduleId, details: { name, language } })
    return mod
  }

  recordMetrics(moduleId: string, cyclomaticComplexity: number, linesOfCode: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.modules.has(moduleId)) throw new Error(`모듈을 찾을 수 없습니다: ${moduleId}`)
    this.metrics.set(moduleId, { cyclomaticComplexity, linesOfCode })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_METRICS', moduleId, details: { cyclomaticComplexity, linesOfCode } })
  }

  getComplexityGrade(moduleId: string): ComplexityGrade {
    const metric = this.metrics.get(moduleId)
    if (!metric) return 'low'
    if (metric.cyclomaticComplexity >= 20) return 'high'
    if (metric.cyclomaticComplexity >= 10) return 'medium'
    return 'low'
  }

  getHighComplexityModules(): CodeModule[] {
    return Array.from(this.modules.values()).filter(m => this.getComplexityGrade(m.moduleId) === 'high')
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
