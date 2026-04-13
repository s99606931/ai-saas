// Design Ref: §R391 — AI기반 클라우드 보안 자세 관리
// Plan SC: SC-R391

export interface CloudResource {
  resourceId: string
  resourceType: 'VM' | 'STORAGE' | 'DATABASE' | 'NETWORK' | 'IAM'
  region: string
  tags: Record<string, string>
  isPubliclyAccessible: boolean
  encryptionEnabled: boolean
  loggingEnabled: boolean
  mfaEnabled?: boolean
}

export type PostureSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

export interface PostureFinding {
  findingId: string
  resourceId: string
  severity: PostureSeverity
  ruleId: string
  description: string
  recommendation: string
  autoRemediable: boolean
}

export interface PostureReport {
  accountId: string
  totalResources: number
  totalFindings: number
  criticalCount: number
  highCount: number
  postureScore: number
  findings: PostureFinding[]
  remediationPlan: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

let findingCounter = 0
function nextFindingId(): string {
  findingCounter += 1
  return `FINDING-${String(findingCounter).padStart(4, '0')}`
}

export class CloudSecurityPostureManagerAi {
  private resources = new Map<string, CloudResource>()
  private auditLog: AuditEntry[] = []

  registerResource(resource: CloudResource): void {
    this.resources.set(resource.resourceId, resource)
    this.auditLog.push({ action: 'resource.register', timestamp: new Date().toISOString(), detail: `${resource.resourceId}(${resource.resourceType})` })
  }

  assess(accountId: string): PostureReport {
    const findings: PostureFinding[] = []
    const resources = Array.from(this.resources.values())

    for (const resource of resources) {
      // 공개 접근 가능 + 암호화 미적용
      if (resource.isPubliclyAccessible && !resource.encryptionEnabled) {
        findings.push({
          findingId: nextFindingId(),
          resourceId: resource.resourceId,
          severity: 'CRITICAL',
          ruleId: 'CSP-001',
          description: `${resource.resourceId}: 공개 접근 + 암호화 미적용 — 데이터 노출 위험`,
          recommendation: '즉시 접근 범위 제한 및 AES-256 암호화 적용',
          autoRemediable: false,
        })
      } else if (resource.isPubliclyAccessible) {
        findings.push({
          findingId: nextFindingId(),
          resourceId: resource.resourceId,
          severity: 'HIGH',
          ruleId: 'CSP-002',
          description: `${resource.resourceId}: 공개 접근 허용 — 불필요한 노출`,
          recommendation: '접근 범위를 필요 최소한으로 제한',
          autoRemediable: true,
        })
      }

      // 로깅 미적용
      if (!resource.loggingEnabled) {
        findings.push({
          findingId: nextFindingId(),
          resourceId: resource.resourceId,
          severity: 'MEDIUM',
          ruleId: 'CSP-003',
          description: `${resource.resourceId}: 감사 로깅 미활성화 — CSAP D-06 위반`,
          recommendation: '리소스 접근 감사 로그 활성화',
          autoRemediable: true,
        })
      }

      // IAM MFA 미적용
      if (resource.resourceType === 'IAM' && resource.mfaEnabled === false) {
        findings.push({
          findingId: nextFindingId(),
          resourceId: resource.resourceId,
          severity: 'HIGH',
          ruleId: 'CSP-004',
          description: `${resource.resourceId}: IAM MFA 미적용 — 계정 탈취 위험`,
          recommendation: 'MFA 즉시 활성화 (CSAP D-08)',
          autoRemediable: false,
        })
      }
    }

    const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length
    const highCount = findings.filter((f) => f.severity === 'HIGH').length
    const postureScore = Math.max(0, 100 - criticalCount * 25 - highCount * 10 - findings.filter((f) => f.severity === 'MEDIUM').length * 5)

    const remediationPlan: string[] = []
    if (criticalCount > 0) remediationPlan.push(`즉시 조치: CRITICAL 항목 ${criticalCount}개 — 접근 차단 및 암호화`)
    if (highCount > 0) remediationPlan.push(`24시간 이내: HIGH 항목 ${highCount}개 처리`)
    const mediumCount = findings.filter((f) => f.severity === 'MEDIUM').length
    if (mediumCount > 0) remediationPlan.push(`7일 이내: MEDIUM 항목 ${mediumCount}개 처리`)

    this.auditLog.push({ action: 'posture.assess', timestamp: new Date().toISOString(), detail: `${accountId}:score=${postureScore}` })
    return {
      accountId,
      totalResources: resources.length,
      totalFindings: findings.length,
      criticalCount,
      highCount,
      postureScore,
      findings,
      remediationPlan,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
