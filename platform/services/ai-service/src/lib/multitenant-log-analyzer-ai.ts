// Design Ref: §R255 — AI기반 멀티테넌트 로그 분석
// Plan SC: SVC-AI-ADV-R255-SC01
// CSAP D-06: 감사 로그, D-08: 테넌트 격리

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
export type AnomalyType = 'ERROR_SPIKE' | 'UNUSUAL_PATTERN' | 'SECURITY_EVENT' | 'PERFORMANCE_DEGRADATION'

export interface TenantConfig {
  tenantId: string
  name: string
  errorRateThreshold: number  // 0~1
  logRetentionDays: number
}

export interface LogEntry {
  tenantId: string
  entryId: string
  level: LogLevel
  message: string
  timestamp: number
  sourceIp?: string
}

export interface LogAnalysis {
  tenantId: string
  totalLogs: number
  errorRate: number
  anomalies: Array<{ type: AnomalyType; severity: 'HIGH' | 'MEDIUM' | 'LOW'; detail: string }>
  topErrors: string[]
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  tenantId: string
  detail: Record<string, unknown>
}

const SECURITY_KEYWORDS = ['injection', 'xss', 'csrf', 'unauthorized', 'forbidden', '401', '403']

export class MultitenantLogAnalyzerAi {
  private tenants = new Map<string, TenantConfig>()
  private logs = new Map<string, LogEntry[]>()
  private auditLog: AuditEntry[] = []

  registerTenant(config: TenantConfig): void {
    this.tenants.set(config.tenantId, config)
    this.logs.set(config.tenantId, [])
    this.appendAudit('tenant.register', config.tenantId, { name: config.name })
  }

  ingestLog(entry: LogEntry): void {
    if (!this.tenants.has(entry.tenantId)) throw new Error(`Unknown tenant: ${entry.tenantId}`)
    const list = this.logs.get(entry.tenantId) ?? []
    list.push(entry)
    this.logs.set(entry.tenantId, list)
  }

  analyze(tenantId: string): LogAnalysis {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) throw new Error(`Unknown tenant: ${tenantId}`)

    const allLogs = this.logs.get(tenantId) ?? []
    const anomalies: LogAnalysis['anomalies'] = []

    const errorLogs = allLogs.filter((l) => l.level === 'ERROR' || l.level === 'CRITICAL')
    const errorRate = allLogs.length > 0 ? errorLogs.length / allLogs.length : 0

    // 에러율 급증
    if (errorRate > tenant.errorRateThreshold) {
      anomalies.push({
        type: 'ERROR_SPIKE',
        severity: errorRate > tenant.errorRateThreshold * 2 ? 'HIGH' : 'MEDIUM',
        detail: `에러율 ${Math.round(errorRate * 100)}% — 임계값 ${Math.round(tenant.errorRateThreshold * 100)}% 초과`,
      })
    }

    // 보안 이벤트 탐지
    const securityLogs = allLogs.filter((l) =>
      SECURITY_KEYWORDS.some((k) => l.message.toLowerCase().includes(k))
    )
    if (securityLogs.length > 0) {
      anomalies.push({
        type: 'SECURITY_EVENT',
        severity: 'HIGH',
        detail: `보안 관련 로그 ${securityLogs.length}건 탐지`,
      })
    }

    // CRITICAL 로그 성능 이상
    const criticalLogs = allLogs.filter((l) => l.level === 'CRITICAL')
    if (criticalLogs.length > 0) {
      anomalies.push({
        type: 'PERFORMANCE_DEGRADATION',
        severity: 'HIGH',
        detail: `CRITICAL 로그 ${criticalLogs.length}건 — 즉시 점검 필요`,
      })
    }

    // 상위 에러 메시지
    const errorMsgCount = new Map<string, number>()
    for (const log of errorLogs) {
      const key = log.message.substring(0, 50)
      errorMsgCount.set(key, (errorMsgCount.get(key) ?? 0) + 1)
    }
    const topErrors = [...errorMsgCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([msg]) => msg)

    const recommendation =
      anomalies.some((a) => a.severity === 'HIGH') ? '즉시 점검 필요 — 운영팀 알림 발송' :
      anomalies.length > 0 ? '모니터링 강화 및 원인 분석 권고' :
      '로그 패턴 정상 — 주기적 검토 유지'

    this.appendAudit('log.analyze', tenantId, { totalLogs: allLogs.length, errorRate: Math.round(errorRate * 100) / 100, anomalyCount: anomalies.length })

    return { tenantId, totalLogs: allLogs.length, errorRate: Math.round(errorRate * 100) / 100, anomalies, topErrors, recommendation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, tenantId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, tenantId, detail })
  }
}
