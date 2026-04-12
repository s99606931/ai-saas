// Design Ref: §R212 — AI기반 코드 품질 자동 개선
// Plan SC: SVC-AI-ADV-R212-SC01

export type IssueSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type IssueType = 'SECURITY' | 'PERFORMANCE' | 'MAINTAINABILITY' | 'STYLE'

export interface CodeIssue {
  issueId: string
  file: string
  line: number
  type: IssueType
  severity: IssueSeverity
  message: string
  suggestedFix?: string
}

export interface CodeQualityReport {
  fileCount: number
  totalIssues: number
  issuesBySeverity: Record<IssueSeverity, number>
  issuesByType: Record<IssueType, number>
  qualityScore: number  // 0~100
  topIssues: CodeIssue[]
  passed: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class CodeQualityImproverAI {
  private auditLog: AuditEntry[] = []

  analyze(issues: CodeIssue[], fileCount: number): CodeQualityReport {
    const issuesBySeverity: Record<IssueSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    const issuesByType: Record<IssueType, number> = { SECURITY: 0, PERFORMANCE: 0, MAINTAINABILITY: 0, STYLE: 0 }

    for (const issue of issues) {
      issuesBySeverity[issue.severity]++
      issuesByType[issue.type]++
    }

    // 품질 점수: CRITICAL(-20), HIGH(-10), MEDIUM(-5), LOW(-1) 감점
    const deduction =
      issuesBySeverity.CRITICAL * 20 +
      issuesBySeverity.HIGH * 10 +
      issuesBySeverity.MEDIUM * 5 +
      issuesBySeverity.LOW * 1

    const qualityScore = Math.max(0, 100 - deduction)
    const passed = issuesBySeverity.CRITICAL === 0 && qualityScore >= 60

    // 상위 이슈 (CRITICAL → HIGH → MEDIUM → LOW, 최대 5개)
    const severityOrder: Record<IssueSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    const topIssues = [...issues]
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, 5)

    this.appendAudit('quality.analyze', { fileCount, totalIssues: issues.length, qualityScore })

    return {
      fileCount,
      totalIssues: issues.length,
      issuesBySeverity,
      issuesByType,
      qualityScore,
      topIssues,
      passed,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
