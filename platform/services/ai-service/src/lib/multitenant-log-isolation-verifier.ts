// Design Ref: §R420 — AI기반 멀티테넌트 로그 분리 검증
// Plan SC: SC-R420

export interface LogEntry {
  logId: string
  tenantId: string
  userId: string
  message: string
  timestamp: string
  serviceName: string
}

export interface IsolationViolation {
  logId: string
  tenantId: string
  suspectedLeakTenantId: string
  severity: 'CRITICAL'
  description: string
}

export type IsolationStatus = 'ISOLATED' | 'VIOLATED'

export interface IsolationVerificationReport {
  tenantId: string
  totalLogs: number
  violationCount: number
  isolationStatus: IsolationStatus
  violations: IsolationViolation[]
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskUserId(userId: string): string {
  if (userId.length <= 3) return '*'.repeat(userId.length)
  return userId.slice(0, 2) + '*'.repeat(userId.length - 4) + userId.slice(-2)
}

export class MultitenantLogIsolationVerifier {
  private logs = new Map<string, LogEntry[]>()
  private allTenantIds = new Set<string>()
  private auditLog: AuditEntry[] = []

  submitLog(entry: LogEntry): void {
    if (!this.logs.has(entry.tenantId)) this.logs.set(entry.tenantId, [])
    this.logs.get(entry.tenantId)!.push(entry)
    this.allTenantIds.add(entry.tenantId)
    // PII: userId 마스킹
    this.auditLog.push({ action: 'log.submit', timestamp: new Date().toISOString(), detail: `${entry.tenantId}:${maskUserId(entry.userId)}` })
  }

  verify(tenantId: string): IsolationVerificationReport {
    const logs = this.logs.get(tenantId) ?? []
    const violations: IsolationViolation[] = []

    // 다른 테넌트 ID가 메시지 내에 포함된 경우 혼재 감지
    const otherTenantIds = Array.from(this.allTenantIds).filter((id) => id !== tenantId)

    for (const log of logs) {
      for (const otherTenantId of otherTenantIds) {
        if (log.message.includes(otherTenantId) || log.serviceName.includes(otherTenantId)) {
          violations.push({
            logId: log.logId,
            tenantId,
            suspectedLeakTenantId: otherTenantId,
            severity: 'CRITICAL',
            description: `로그 ${log.logId}에서 타 테넌트(${otherTenantId}) 정보 혼재 감지 — 격리 위반`,
          })
          break
        }
      }
    }

    const isolationStatus: IsolationStatus = violations.length > 0 ? 'VIOLATED' : 'ISOLATED'
    const recommendations: string[] = []
    if (violations.length > 0) {
      recommendations.push(`CRITICAL: 로그 격리 위반 ${violations.length}건 — 즉시 로그 파이프라인 분리 검토`)
      recommendations.push('테넌트별 독립 로그 스토리지 구성 (CSAP D-08 준수)')
    }

    this.auditLog.push({ action: 'isolation.verify', timestamp: new Date().toISOString(), detail: `${tenantId}:${isolationStatus}` })
    return { tenantId, totalLogs: logs.length, violationCount: violations.length, isolationStatus, violations, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
