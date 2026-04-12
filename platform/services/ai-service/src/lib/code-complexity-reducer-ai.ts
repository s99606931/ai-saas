// Design Ref: §핵심 알고리즘 — 복잡도 점수 계산, 리팩토링 제안
// Plan SC: SVC-AI-ADV-R309
export type DataGrade = 'O' | 'C' | 'S'

export interface FunctionRecord {
  id: string
  fileName: string
  functionName: string
  lines: number
}

export interface ComplexityMeasurement {
  cyclomaticComplexity: number
  nestingDepth: number
  paramCount: number
}

export interface ComplexityResult {
  funcId: string
  complexityScore: number
  depthScore: number
  paramScore: number
  totalScore: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class CodeComplexityReducerAI {
  private functions = new Map<string, FunctionRecord>()
  private measurements = new Map<string, ComplexityMeasurement>()
  private auditLog: AuditEntry[] = []

  registerFunction(id: string, fileName: string, functionName: string, lines: number): void {
    if (!id || !fileName || !functionName) throw new Error('id, fileName, functionName은 필수')
    this.functions.set(id, { id, fileName, functionName, lines })
    this.auditLog.push({ action: 'function.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordComplexity(
    funcId: string,
    cyclomaticComplexity: number,
    nestingDepth: number,
    paramCount: number,
    grade: DataGrade = 'O'
  ): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 코드 데이터 분석 금지 (N2SF N-05)`)
    }
    if (!this.functions.has(funcId)) throw new Error(`funcId 없음: ${funcId}`)
    this.measurements.set(funcId, { cyclomaticComplexity, nestingDepth, paramCount })
    this.auditLog.push({
      action: 'complexity.record',
      timestamp: new Date().toISOString(),
      detail: `${funcId}:cc=${cyclomaticComplexity}`,
    })
  }

  calculateComplexityScore(funcId: string): ComplexityResult {
    if (!this.functions.has(funcId)) throw new Error(`funcId 없음: ${funcId}`)
    const m = this.measurements.get(funcId)
    if (!m) throw new Error(`측정 데이터 없음: ${funcId}`)
    const complexityScore = Math.min(100, m.cyclomaticComplexity * 10)
    const depthScore = Math.min(100, m.nestingDepth * 20)
    const paramScore = Math.min(100, m.paramCount * 15)
    const totalScore = complexityScore * 0.5 + depthScore * 0.3 + paramScore * 0.2
    return {
      funcId,
      complexityScore,
      depthScore,
      paramScore,
      totalScore: Math.round(totalScore * 100) / 100,
    }
  }

  getRefactoringSuggestions(funcId: string): string[] {
    if (!this.functions.has(funcId)) throw new Error(`funcId 없음: ${funcId}`)
    const func = this.functions.get(funcId)!
    const m = this.measurements.get(funcId)
    if (!m) return []
    const suggestions: string[] = []
    if (m.cyclomaticComplexity > 10) suggestions.push('함수 분리 검토')
    if (m.nestingDepth > 4) suggestions.push('Early return 패턴 적용 검토')
    if (m.paramCount > 5) suggestions.push('파라미터 객체 패턴 적용 검토')
    if (func.lines > 80) suggestions.push('단일 책임 원칙 위반 — 함수 분리 필요')
    return suggestions
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
