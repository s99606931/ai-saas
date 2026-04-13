// Design Ref: §R269 — AI기반 클라우드 네이티브 보안 스캔
// Plan SC: SVC-AI-ADV-R269-SC01
// CSAP D-06: 감사 로그, D-08: 접근 통제, D-12: 입력 검증

export type ResourceType = 'POD' | 'DEPLOYMENT' | 'SERVICE' | 'CONFIGMAP' | 'SECRET' | 'INGRESS'
export type ScanSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type ViolationRule =
  | 'PRIVILEGED_CONTAINER'
  | 'ROOT_USER'
  | 'NO_RESOURCE_LIMITS'
  | 'HOST_NETWORK'
  | 'SECRET_IN_ENV'
  | 'NO_READONLY_FS'
  | 'MISSING_SECURITY_CONTEXT'

export interface CloudResource {
  resourceId: string
  name: string
  namespace: string
  resourceType: ResourceType
  labels: Record<string, string>
  privileged: boolean
  runAsRoot: boolean
  hasResourceLimits: boolean
  hostNetwork: boolean
  secretsInEnv: boolean
  readOnlyFs: boolean
  hasSecurityContext: boolean
}

export interface SecurityViolation {
  resourceId: string
  rule: ViolationRule
  severity: ScanSeverity
  description: string
}

export interface ScanReport {
  resourceId: string
  violations: SecurityViolation[]
  overallRisk: ScanSeverity | 'PASS'
  score: number  // 0~100, 높을수록 안전
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  resourceId: string
  detail: Record<string, unknown>
}

const VIOLATION_WEIGHTS: Record<ViolationRule, { severity: ScanSeverity; score: number }> = {
  PRIVILEGED_CONTAINER:     { severity: 'CRITICAL', score: 30 },
  ROOT_USER:                { severity: 'CRITICAL', score: 25 },
  HOST_NETWORK:             { severity: 'HIGH',     score: 20 },
  SECRET_IN_ENV:            { severity: 'HIGH',     score: 15 },
  NO_RESOURCE_LIMITS:       { severity: 'MEDIUM',   score: 10 },
  NO_READONLY_FS:           { severity: 'MEDIUM',   score: 10 },
  MISSING_SECURITY_CONTEXT: { severity: 'LOW',      score: 5  },
}

export class CloudNativeSecurityScanner {
  private resources = new Map<string, CloudResource>()
  private auditLog: AuditEntry[] = []

  registerResource(resource: CloudResource): void {
    this.resources.set(resource.resourceId, resource)
    this.appendAudit('resource.register', resource.resourceId, { name: resource.name, type: resource.resourceType })
  }

  scan(resourceId: string): ScanReport {
    const resource = this.resources.get(resourceId)
    if (!resource) throw new Error(`Unknown resource: ${resourceId}`)

    const violations: SecurityViolation[] = []

    if (resource.privileged) {
      violations.push({ resourceId, rule: 'PRIVILEGED_CONTAINER', severity: 'CRITICAL', description: '특권 컨테이너 실행 — 호스트 접근 가능' })
    }
    if (resource.runAsRoot) {
      violations.push({ resourceId, rule: 'ROOT_USER', severity: 'CRITICAL', description: 'root 사용자로 실행 — 권한 상승 위험' })
    }
    if (resource.hostNetwork) {
      violations.push({ resourceId, rule: 'HOST_NETWORK', severity: 'HIGH', description: '호스트 네트워크 사용 — 네트워크 격리 우회' })
    }
    if (resource.secretsInEnv) {
      violations.push({ resourceId, rule: 'SECRET_IN_ENV', severity: 'HIGH', description: '환경 변수에 시크릿 노출' })
    }
    if (!resource.hasResourceLimits) {
      violations.push({ resourceId, rule: 'NO_RESOURCE_LIMITS', severity: 'MEDIUM', description: 'CPU/메모리 리소스 제한 없음' })
    }
    if (!resource.readOnlyFs) {
      violations.push({ resourceId, rule: 'NO_READONLY_FS', severity: 'MEDIUM', description: '읽기 전용 파일시스템 미설정' })
    }
    if (!resource.hasSecurityContext) {
      violations.push({ resourceId, rule: 'MISSING_SECURITY_CONTEXT', severity: 'LOW', description: 'SecurityContext 미설정' })
    }

    const totalDeduction = violations.reduce((s, v) => s + VIOLATION_WEIGHTS[v.rule].score, 0)
    const score = Math.max(0, 100 - totalDeduction)

    const hasCritical = violations.some((v) => v.severity === 'CRITICAL')
    const hasHigh = violations.some((v) => v.severity === 'HIGH')
    const overallRisk: ScanSeverity | 'PASS' =
      hasCritical ? 'CRITICAL' :
      hasHigh ? 'HIGH' :
      violations.length > 0 ? 'MEDIUM' : 'PASS'

    const recommendation =
      overallRisk === 'CRITICAL' ? '즉시 배포 중단 및 보안 패치 필요' :
      overallRisk === 'HIGH' ? '24시간 내 보안 설정 보강 필요' :
      overallRisk === 'MEDIUM' ? '보안 베스트 프랙티스 적용 권고' :
      '보안 설정 양호'

    this.appendAudit('resource.scan', resourceId, { overallRisk, score, violationCount: violations.length })

    return { resourceId, violations, overallRisk, score, recommendation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, resourceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, resourceId, detail })
  }
}
