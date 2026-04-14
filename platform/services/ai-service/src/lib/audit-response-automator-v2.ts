// Design Ref: §R520 — AI기반 공공기관 감사 대응 자동화 v2
// Plan SC: SVC-AI-ADV-R520-SC01

export type AuditType = 'CSAP' | 'INTERNAL' | 'EXTERNAL' | 'REGULATORY' | 'FINANCIAL'
export type FindingSeverity = 'OBSERVATION' | 'MINOR' | 'MAJOR' | 'CRITICAL'
export type ResponseStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ACCEPTED'

export interface AuditFinding {
  findingId: string
  auditType: AuditType
  severity: FindingSeverity
  category: string
  description: string
  dueDate: string   // YYYY-MM-DD
}

export interface AuditResponse {
  findingId: string
  responseText: string
  assignedTo: string
  plannedActions: string[]
  status: ResponseStatus
  evidenceRequired: string[]
}

export interface AuditResponseReport {
  totalFindings: number
  criticalCount: number
  resolvedCount: number
  overdueCount: number
  responses: AuditResponse[]
  complianceScore: number   // 0..100
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  findingId: string
  detail: Record<string, unknown>
}

const EVIDENCE_BY_CATEGORY: Record<string, string[]> = {
  'ACCESS_CONTROL': ['접근 권한 목록', '권한 부여 이력', 'RBAC 정책 문서'],
  'ENCRYPTION': ['암호화 설정 문서', '키 관리 정책', '암호화 검증 결과'],
  'AUDIT_LOG': ['감사 로그 샘플', '로그 보존 정책', '로그 무결성 증명'],
  'PATCH_MANAGEMENT': ['패치 적용 이력', '취약점 스캔 결과', '패치 관리 절차서'],
}

export class AuditResponseAutomatorV2 {
  private findings = new Map<string, AuditFinding>()
  private responses = new Map<string, AuditResponse>()
  private auditLog: AuditEntry[] = []

  registerFinding(finding: AuditFinding): void {
    this.findings.set(finding.findingId, finding)
    this.appendAudit('finding.register', finding.findingId, { severity: finding.severity, category: finding.category })
  }

  generateResponse(findingId: string): AuditResponse {
    const finding = this.findings.get(findingId)
    if (!finding) throw new Error(`Unknown finding: ${findingId}`)

    this.appendAudit('response.generate', findingId, { severity: finding.severity })

    const evidenceRequired = EVIDENCE_BY_CATEGORY[finding.category] ?? ['관련 문서', '조치 계획서']

    const plannedActions: string[] = []
    if (finding.severity === 'CRITICAL') {
      plannedActions.push('즉시 조치 (24시간 내)')
      plannedActions.push('경영진 보고')
      plannedActions.push('재발 방지 계획 수립')
    } else if (finding.severity === 'MAJOR') {
      plannedActions.push(`${finding.dueDate}까지 시정 조치 완료`)
      plannedActions.push('담당자 지정 및 진행 상황 주간 보고')
    } else {
      plannedActions.push(`${finding.dueDate}까지 검토 및 조치`)
    }

    const assignedTo = finding.severity === 'CRITICAL' ? '정보보안팀장' : '담당 부서장'

    const response: AuditResponse = {
      findingId,
      responseText: `[${finding.auditType}] ${finding.category} 지적사항에 대해 ${finding.severity} 수준으로 대응합니다.`,
      assignedTo,
      plannedActions,
      status: 'IN_PROGRESS',
      evidenceRequired,
    }

    this.responses.set(findingId, response)
    this.appendAudit('response.created', findingId, { status: response.status, assignedTo })
    return response
  }

  resolve(findingId: string): boolean {
    const response = this.responses.get(findingId)
    if (!response) return false
    response.status = 'RESOLVED'
    this.responses.set(findingId, response)
    this.appendAudit('response.resolved', findingId, {})
    return true
  }

  generateReport(today: string): AuditResponseReport {
    const allFindings = Array.from(this.findings.values())
    const allResponses = Array.from(this.responses.values())
    this.appendAudit('report.generate', 'system', { findingCount: allFindings.length })

    const criticalCount = allFindings.filter((f) => f.severity === 'CRITICAL').length
    const resolvedCount = allResponses.filter((r) => r.status === 'RESOLVED').length
    const overdueCount = allFindings.filter((f) => f.dueDate < today && !this.responses.get(f.findingId)?.status.includes('RESOLVED')).length

    const complianceScore = allFindings.length > 0
      ? Math.max(0, Math.round(100 - criticalCount * 20 - overdueCount * 10))
      : 100

    const recommendations: string[] = []
    if (criticalCount > 0) recommendations.push(`CRITICAL 지적사항 ${criticalCount}건 즉시 조치 필요`)
    if (overdueCount > 0) recommendations.push(`기한 초과 ${overdueCount}건 — 조치 계획 재검토`)

    return { totalFindings: allFindings.length, criticalCount, resolvedCount, overdueCount, responses: allResponses, complianceScore, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, findingId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, findingId, detail })
  }
}
