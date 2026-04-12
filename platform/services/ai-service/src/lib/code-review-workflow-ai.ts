// Design Ref: §R223 — AI기반 자동 코드 리뷰 워크플로우
// Plan SC: SVC-AI-ADV-R223-SC01
// CSAP D-12: 시스템 개발 보안

export type ReviewStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED'
export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

export interface PullRequest {
  prId: string
  title: string
  author: string
  changedFiles: string[]
  linesAdded: number
  linesRemoved: number
  targetBranch: string
}

export interface ReviewFinding {
  findingId: string
  file: string
  line?: number
  severity: FindingSeverity
  category: 'SECURITY' | 'PERFORMANCE' | 'STYLE' | 'LOGIC' | 'TEST_COVERAGE'
  message: string
  suggestion?: string
}

export interface ReviewResult {
  prId: string
  status: ReviewStatus
  findings: ReviewFinding[]
  approvalScore: number  // 0~100
  reviewedAt: string
  blockers: number
}

interface AuditEntry {
  timestamp: string
  action: string
  prId: string
  detail: Record<string, unknown>
}

const SECURITY_PATTERNS = ['eval(', 'innerHTML', 'dangerouslySetInnerHTML', 'exec(', 'system(', 'hardcoded_secret']
const LARGE_PR_THRESHOLD = 500

export class CodeReviewWorkflowAI {
  private auditLog: AuditEntry[] = []

  review(pr: PullRequest, findings: ReviewFinding[]): ReviewResult {
    this.appendAudit('review.start', pr.prId, { author: pr.author, files: pr.changedFiles.length })

    const allFindings = [...findings]

    // 자동 탐지: 대규모 PR 경고
    if (pr.linesAdded + pr.linesRemoved > LARGE_PR_THRESHOLD) {
      allFindings.push({
        findingId: `AUTO-SIZE-${pr.prId}`,
        file: 'PR',
        severity: 'MEDIUM',
        category: 'STYLE',
        message: `대규모 PR (${pr.linesAdded + pr.linesRemoved}줄 변경) — 분할 검토 권장`,
      })
    }

    // 자동 탐지: 보안 패턴 (파일명 기반 휴리스틱)
    for (const file of pr.changedFiles) {
      for (const pattern of SECURITY_PATTERNS) {
        if (file.toLowerCase().includes('secret') || file.toLowerCase().includes('credential')) {
          allFindings.push({
            findingId: `AUTO-SEC-${pr.prId}-${file}`,
            file,
            severity: 'HIGH',
            category: 'SECURITY',
            message: `민감 파일 변경 감지: ${file}`,
            suggestion: '시크릿 파일 변경 시 보안 팀 검토 필수',
          })
          break
        }
        if (pattern) break  // 패턴 확인 완료
      }
    }

    const blockers = allFindings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH').length
    const deduction = allFindings.reduce((sum, f) => {
      const weights: Record<FindingSeverity, number> = { CRITICAL: 30, HIGH: 15, MEDIUM: 7, LOW: 2, INFO: 0 }
      return sum + (weights[f.severity] ?? 0)
    }, 0)

    const approvalScore = Math.max(0, 100 - deduction)
    const status: ReviewStatus =
      allFindings.some((f) => f.severity === 'CRITICAL') ? 'REJECTED'
        : blockers > 0 ? 'CHANGES_REQUESTED'
        : approvalScore >= 80 ? 'APPROVED'
        : 'CHANGES_REQUESTED'

    this.appendAudit('review.complete', pr.prId, { status, blockers, approvalScore })

    return {
      prId: pr.prId,
      status,
      findings: allFindings,
      approvalScore,
      reviewedAt: new Date().toISOString(),
      blockers,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, prId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, prId, detail })
  }
}
