/**
 * Code Review Auto Approver — SVC-AI-ADV-R147 (트랙 B 3차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R146-R153-trackB/SVC-AI-ADV-R147.design.md
 * Plan SC: FR-R147.1 ~ FR-R147.4
 *
 * 변경 위험도 자동 평가 → 저위험 PR 자동 승인 결정.
 * CSAP D-12: 시크릿/보안 파일 변경 자동 차단.
 */

// Design Ref: §2 — 타입 정의

export type Decision = 'AUTO_APPROVE' | 'REQUEST_REVIEW' | 'BLOCK'

export interface RiskRule {
  ruleId: string
  pattern: string
  riskScore: number
  description: string
}

export interface PrFile {
  path: string
  additions: number
  deletions: number
}

export interface PrInfo {
  prId: string
  title: string
  files: PrFile[]
}

export interface PrEvaluation {
  prId: string
  totalScore: number
  decision: Decision
  triggeredRules: string[]
  evaluatedAt: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  prId: string
  decision: Decision
}

// Design Ref: §3.4 기본 규칙 (CSAP D-12 보안 파일)
const DEFAULT_RULES: RiskRule[] = [
  { ruleId: 'R-SEC-001', pattern: '\\.env$|\\.env\\.', riskScore: 80, description: '환경 변수 파일 변경' },
  { ruleId: 'R-SEC-002', pattern: 'secrets?\\.', riskScore: 80, description: '시크릿 파일 변경' },
  { ruleId: 'R-SEC-003', pattern: '\\.key$|\\.pem$|\\.p12$', riskScore: 80, description: '키/인증서 파일 변경' },
  { ruleId: 'R-SEC-004', pattern: 'password|credential', riskScore: 50, description: '자격증명 관련 파일' },
  { ruleId: 'R-MIG-001', pattern: 'migration|migrate', riskScore: 40, description: 'DB 마이그레이션 변경' },
  { ruleId: 'R-INF-001', pattern: 'Dockerfile|docker-compose', riskScore: 30, description: '컨테이너 설정 변경' },
  { ruleId: 'R-CI-001', pattern: '\\.github|\\.gitlab-ci|\\.drone', riskScore: 30, description: 'CI/CD 파이프라인 변경' },
]

export class CodeReviewAutoApprover {
  private readonly rules = new Map<string, RiskRule>()
  private readonly history: PrEvaluation[] = []
  private readonly auditLog: AuditEntry[] = []
  private readonly approveThreshold = 30
  private readonly blockThreshold = 80

  constructor() {
    for (const rule of DEFAULT_RULES) {
      this.rules.set(rule.ruleId, rule)
    }
  }

  // Plan SC: FR-R147.1
  registerRiskRule(rule: RiskRule): void {
    this.rules.set(rule.ruleId, { ...rule })
  }

  // Plan SC: FR-R147.2 — Design Ref: §3.1~§3.3
  evaluatePr(pr: PrInfo): PrEvaluation {
    let totalScore = 0
    const triggeredRules: string[] = []

    for (const file of pr.files) {
      for (const rule of this.rules.values()) {
        const regex = new RegExp(rule.pattern, 'i')
        if (regex.test(file.path)) {
          totalScore += rule.riskScore
          if (!triggeredRules.includes(rule.description)) {
            triggeredRules.push(rule.description)
          }
        }
      }
    }

    // Design Ref: §3.2 크기 보정
    const totalChanges = pr.files.reduce(
      (sum, f) => sum + f.additions + f.deletions, 0,
    )
    if (totalChanges > 500) {
      totalScore += 20
      triggeredRules.push('대규모 변경 (+500 lines)')
    }

    // Design Ref: §3.3 결정
    let decision: Decision
    if (totalScore >= this.blockThreshold) decision = 'BLOCK'
    else if (totalScore >= this.approveThreshold) decision = 'REQUEST_REVIEW'
    else decision = 'AUTO_APPROVE'

    const evaluation: PrEvaluation = {
      prId: pr.prId,
      totalScore,
      decision,
      triggeredRules,
      evaluatedAt: new Date().toISOString(),
    }
    this.history.push(evaluation)
    this.appendAudit(pr.prId, decision)
    return evaluation
  }

  // Plan SC: FR-R147.3
  getDecisionHistory(): PrEvaluation[] {
    return [...this.history]
  }

  // Plan SC: FR-R147.4 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(prId: string, decision: Decision): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'pr.evaluate', prId, decision })
  }
}
