/**
 * AI 기반 기술 부채 측정기 — SVC-AI-ADV-R122
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R122/SVC-AI-ADV-R122.design.md
 * Plan SC: FR-R122.1 ~ FR-R122.6
 *
 * 코드 복잡도/중복/오래된 의존성 분석 → 기술 부채 점수 산출.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

// Plan SC: FR-R122.5
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface FileMetrics {
  path: string
  lines: number
  cyclomaticComplexity: number
  duplicateRatio: number // 0~1
  dependencyAge: number  // days since last update
  grade: DataGrade
}

export interface DebtScore {
  path: string
  complexityDebt: number   // 0~100
  duplicationDebt: number  // 0~100
  dependencyDebt: number   // 0~100
  total: number            // weighted average 0~100
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface DebtSummary {
  files: DebtScore[]
  avgTotal: number
  hotspots: DebtScore[]   // severity HIGH or CRITICAL
  timestamp: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

// Weights for debt calculation — Plan SC: FR-R122.3
const WEIGHTS = { complexity: 0.4, duplication: 0.35, dependency: 0.25 }

export class TechDebtAnalyzer {
  private readonly metrics: FileMetrics[] = []
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog
  }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R122.1
  registerFile(metrics: FileMetrics): void {
    if (metrics.grade === DataGrade.C || metrics.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${metrics.grade}등급 파일 분석 금지 (N2SF N-05)`)
    }
    const existing = this.metrics.findIndex(m => m.path === metrics.path)
    if (existing >= 0) {
      this.metrics[existing] = metrics
    } else {
      this.metrics.push(metrics)
    }
    this.audit('registerFile', { path: metrics.path })
  }

  // Plan SC: FR-R122.2 — cyclomatic complexity debt
  private complexityScore(cc: number): number {
    // 1-10: low, 11-20: medium, 21-50: high, 50+: critical
    if (cc <= 10) return Math.round((cc / 10) * 30)
    if (cc <= 20) return 30 + Math.round(((cc - 10) / 10) * 30)
    if (cc <= 50) return 60 + Math.round(((cc - 20) / 30) * 30)
    return 100
  }

  // Plan SC: FR-R122.3
  private duplicationScore(ratio: number): number {
    return Math.min(100, Math.round(ratio * 100))
  }

  // Plan SC: FR-R122.4
  private dependencyScore(ageDays: number): number {
    // <180d: 0, <365d: 20, <730d: 50, 730d+: scale to 100
    if (ageDays < 180) return 0
    if (ageDays < 365) return 20
    if (ageDays < 730) return 50
    return Math.min(100, Math.round(50 + ((ageDays - 730) / 730) * 50))
  }

  private classifySeverity(score: number): DebtScore['severity'] {
    if (score < 25) return 'LOW'
    if (score < 50) return 'MEDIUM'
    if (score < 75) return 'HIGH'
    return 'CRITICAL'
  }

  scoreFile(m: FileMetrics): DebtScore {
    const complexityDebt = this.complexityScore(m.cyclomaticComplexity)
    const duplicationDebt = this.duplicationScore(m.duplicateRatio)
    const dependencyDebt = this.dependencyScore(m.dependencyAge)
    const total = Math.round(
      complexityDebt * WEIGHTS.complexity +
      duplicationDebt * WEIGHTS.duplication +
      dependencyDebt * WEIGHTS.dependency
    )
    return {
      path: m.path,
      complexityDebt,
      duplicationDebt,
      dependencyDebt,
      total,
      severity: this.classifySeverity(total),
    }
  }

  // Plan SC: FR-R122.6
  analyze(): DebtSummary {
    const scores = this.metrics.map(m => this.scoreFile(m))
    const avgTotal = scores.length > 0
      ? Math.round(scores.reduce((s, d) => s + d.total, 0) / scores.length)
      : 0
    const hotspots = scores.filter(d => d.severity === 'HIGH' || d.severity === 'CRITICAL')
      .sort((a, b) => b.total - a.total)
    this.audit('analyze', { fileCount: scores.length, avgTotal, hotspots: hotspots.length })
    return { files: scores, avgTotal, hotspots, timestamp: new Date().toISOString() }
  }
}
