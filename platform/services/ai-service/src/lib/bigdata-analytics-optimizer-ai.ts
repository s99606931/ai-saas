// Design Ref: §R612 — AI기반 공공기관 빅데이터 분석 최적화
// Plan SC: SVC-AI-ADV-R612-SC01

export type QueryIssueType = 'FULL_SCAN' | 'SLOW_QUERY' | 'MISSING_PARTITION'
export type OptimizationAction = 'ADD_PARTITION' | 'ADD_INDEX' | 'ENABLE_CACHE' | 'REWRITE_QUERY'

export interface QuerySpec {
  queryId: string
  name: string
  execTimeMs: number
  scannedBytes: number  // bytes
  usesPartition: boolean
  scanType: 'FULL' | 'PARTIAL' | 'INDEX'
}

export interface QueryIssue {
  issueId: string
  queryId: string
  issueType: QueryIssueType
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  detail: string
}

export interface QueryOptimization {
  queryId: string
  name: string
  issues: QueryIssue[]
  recommendations: { action: OptimizationAction; reason: string }[]
  estimatedImprovementPct: number
}

export interface BigdataReport {
  totalQueries: number
  issueCount: number
  avgExecTimeMs: number
  optimizations: QueryOptimization[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  queryId: string
  detail: Record<string, unknown>
}

export class BigdataAnalyticsOptimizerAI {
  private queries = new Map<string, QuerySpec>()
  private auditLog: AuditEntry[] = []

  registerQuery(query: QuerySpec): void {
    this.queries.set(query.queryId, query)
    this.appendAudit('query.register', query.queryId, { name: query.name })
  }

  analyze(): QueryIssue[] {
    const issues: QueryIssue[] = []
    let issueCounter = 0

    for (const query of this.queries.values()) {
      if (query.scanType === 'FULL') {
        issueCounter++
        issues.push({
          issueId: `ISSUE-${issueCounter}`,
          queryId: query.queryId,
          issueType: 'FULL_SCAN',
          severity: 'HIGH',
          detail: `전체 스캔 감지 — 스캔 크기 ${(query.scannedBytes / 1_000_000).toFixed(1)}MB`,
        })
      }
      if (query.execTimeMs > 5000) {
        issueCounter++
        issues.push({
          issueId: `ISSUE-${issueCounter}`,
          queryId: query.queryId,
          issueType: 'SLOW_QUERY',
          severity: 'HIGH',
          detail: `쿼리 실행 시간 ${query.execTimeMs}ms 초과 — 최적화 필요`,
        })
      }
      if (!query.usesPartition) {
        issueCounter++
        issues.push({
          issueId: `ISSUE-${issueCounter}`,
          queryId: query.queryId,
          issueType: 'MISSING_PARTITION',
          severity: 'MEDIUM',
          detail: '파티셔닝 미적용 — 전체 테이블 스캔 비용 증가',
        })
      }
    }

    this.appendAudit('analytics.analyze', 'system', { issueCount: issues.length })
    return issues
  }

  optimize(): QueryOptimization[] {
    const issues = this.analyze()
    const optimizations: QueryOptimization[] = []

    for (const query of this.queries.values()) {
      const queryIssues = issues.filter((i) => i.queryId === query.queryId)
      const recommendations: QueryOptimization['recommendations'] = []
      let estimatedImprovementPct = 0

      for (const issue of queryIssues) {
        if (issue.issueType === 'FULL_SCAN') {
          recommendations.push({ action: 'ADD_INDEX', reason: '인덱스 추가로 전체 스캔 방지 — 쿼리 시간 70% 단축 예상' })
          estimatedImprovementPct = Math.max(estimatedImprovementPct, 70)
        }
        if (issue.issueType === 'SLOW_QUERY') {
          recommendations.push({ action: 'REWRITE_QUERY', reason: '쿼리 재작성 + 캐시 활성화 — 실행 시간 50% 단축 예상' })
          recommendations.push({ action: 'ENABLE_CACHE', reason: '결과 캐싱으로 반복 쿼리 비용 제거' })
          estimatedImprovementPct = Math.max(estimatedImprovementPct, 50)
        }
        if (issue.issueType === 'MISSING_PARTITION') {
          recommendations.push({ action: 'ADD_PARTITION', reason: '날짜/키 기반 파티셔닝 적용 — 스캔 비용 60% 감소 예상' })
          estimatedImprovementPct = Math.max(estimatedImprovementPct, 60)
        }
      }

      optimizations.push({ queryId: query.queryId, name: query.name, issues: queryIssues, recommendations, estimatedImprovementPct })
    }

    this.appendAudit('analytics.optimize', 'system', { optimizationCount: optimizations.length })
    return optimizations
  }

  generateReport(): BigdataReport {
    const optimizations = this.optimize()
    const issueCount = optimizations.reduce((s, o) => s + o.issues.length, 0)
    const queries = Array.from(this.queries.values())
    const avgExecTimeMs = queries.length > 0
      ? Math.round(queries.reduce((s, q) => s + q.execTimeMs, 0) / queries.length)
      : 0

    this.appendAudit('report.generate', 'system', { totalQueries: queries.length, issueCount })
    return {
      totalQueries: queries.length,
      issueCount,
      avgExecTimeMs,
      optimizations,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, queryId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, queryId, detail })
  }
}
