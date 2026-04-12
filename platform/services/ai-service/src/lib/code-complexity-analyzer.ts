/**
 * AI 기반 코드 복잡도 분석기 — SVC-AI-ADV-R123
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R123/SVC-AI-ADV-R123.design.md
 * Plan SC: FR-R123.1 ~ FR-R123.6
 *
 * 순환 복잡도, 인지적 복잡도, 결합도 자동 측정.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface FunctionMetric {
  name: string
  lines: number
  cyclomaticComplexity: number  // McCabe
  cognitiveComplexity: number   // Cognitive complexity (nesting weight)
  parameterCount: number
}

export interface ModuleMetrics {
  path: string
  grade: DataGrade
  functions: FunctionMetric[]
  afferentCoupling: number  // how many modules depend on this
  efferentCoupling: number  // how many modules this depends on
}

export interface ComplexityReport {
  path: string
  avgCyclomatic: number
  avgCognitive: number
  instability: number       // efferent / (afferent + efferent)
  maintenabilityIndex: number // 0-100, higher = easier to maintain
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  riskFunctions: FunctionMetric[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

// Plan SC: FR-R123.3 — Halstead-inspired MI formula (simplified)
function maintainabilityIndex(avgCyclomatic: number, avgCognitive: number, loc: number): number {
  const mi = 171 - 5.2 * Math.log(Math.max(1, avgCognitive)) - 0.23 * avgCyclomatic - 16.2 * Math.log(Math.max(1, loc))
  return Math.max(0, Math.min(100, Math.round(mi)))
}

export class CodeComplexityAnalyzer {
  private readonly modules = new Map<string, ModuleMetrics>()
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog
  }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R123.1
  registerModule(module: ModuleMetrics): void {
    if (module.grade === DataGrade.C || module.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${module.grade}등급 모듈 분석 금지 (N2SF N-05)`)
    }
    this.modules.set(module.path, module)
    this.audit('registerModule', { path: module.path, functions: module.functions.length })
  }

  // Plan SC: FR-R123.2 — cyclomatic complexity per function
  cyclomaticComplexity(fn: FunctionMetric): number {
    return fn.cyclomaticComplexity
  }

  // Plan SC: FR-R123.3 — instability metric (Robert Martin)
  instability(module: ModuleMetrics): number {
    const total = module.afferentCoupling + module.efferentCoupling
    if (total === 0) return 0
    return Math.round((module.efferentCoupling / total) * 100) / 100
  }

  // Plan SC: FR-R123.4 — risk functions: CC > 10 or cognitive > 15
  riskFunctions(functions: FunctionMetric[]): FunctionMetric[] {
    return functions.filter(f => f.cyclomaticComplexity > 10 || f.cognitiveComplexity > 15)
  }

  // Plan SC: FR-R123.5
  gradeFromMI(mi: number): ComplexityReport['grade'] {
    if (mi >= 85) return 'A'
    if (mi >= 65) return 'B'
    if (mi >= 45) return 'C'
    if (mi >= 25) return 'D'
    return 'F'
  }

  // Plan SC: FR-R123.6
  analyzeModule(path: string): ComplexityReport {
    const module = this.modules.get(path)
    if (!module) throw new Error(`module not registered: ${path}`)
    const fns = module.functions
    const totalLOC = fns.reduce((s, f) => s + f.lines, 0)
    const avgCyclomatic = fns.length > 0
      ? Math.round(fns.reduce((s, f) => s + f.cyclomaticComplexity, 0) / fns.length * 10) / 10
      : 0
    const avgCognitive = fns.length > 0
      ? Math.round(fns.reduce((s, f) => s + f.cognitiveComplexity, 0) / fns.length * 10) / 10
      : 0
    const mi = maintainabilityIndex(avgCyclomatic, avgCognitive, totalLOC)
    const report: ComplexityReport = {
      path,
      avgCyclomatic,
      avgCognitive,
      instability: this.instability(module),
      maintenabilityIndex: mi,
      grade: this.gradeFromMI(mi),
      riskFunctions: this.riskFunctions(fns),
    }
    this.audit('analyzeModule', { path, mi, grade: report.grade })
    return report
  }

  analyzeAll(): ComplexityReport[] {
    const reports = [...this.modules.keys()].map(p => this.analyzeModule(p))
    this.audit('analyzeAll', { count: reports.length })
    return reports
  }
}
