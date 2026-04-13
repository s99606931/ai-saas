// Design Ref: §R400 — AI기반 멀티테넌트 이상 행동 분석
// Plan SC: SVC-AI-ADV-R400-SC01

export type BehaviorAnomaly = 'BULK_EXPORT' | 'OFF_HOURS_ACCESS' | 'PRIVILEGE_ESCALATION' | 'DATA_EXFILTRATION' | 'UNUSUAL_VOLUME' | 'CROSS_TENANT_PROBE'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface TenantActivity {
  activityId: string
  tenantId: string
  userId: string
  action: string
  resourceCount: number
  timestamp: number
  targetTenantId?: string  // 다른 테넌트 리소스 접근 시
}

export interface BehaviorAnalysisResult {
  tenantId: string
  anomalies: Array<{ type: BehaviorAnomaly; severity: RiskLevel; detail: string }>
  riskScore: number
  blocked: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  tenantId: string
  detail: Record<string, unknown>
}

export class MultitenantBehaviorAnalyzerAI {
  private activities = new Map<string, TenantActivity[]>()  // tenantId → activities
  private auditLog: AuditEntry[] = []

  ingest(activity: TenantActivity): void {
    const list = this.activities.get(activity.tenantId) ?? []
    list.push(activity)
    this.activities.set(activity.tenantId, list)
  }

  analyze(tenantId: string): BehaviorAnalysisResult {
    const activities = this.activities.get(tenantId) ?? []
    this.appendAudit('behavior.analyze', tenantId, { activityCount: activities.length })

    const anomalies: BehaviorAnalysisResult['anomalies'] = []
    let riskScore = 0

    if (activities.length === 0) {
      return { tenantId, anomalies: [], riskScore: 0, blocked: false }
    }

    // 대량 내보내기: 단일 활동에서 리소스 1000건 이상
    const bulkExport = activities.find((a) => a.resourceCount >= 1000)
    if (bulkExport) {
      anomalies.push({ type: 'BULK_EXPORT', severity: 'HIGH', detail: `단일 작업 ${bulkExport.resourceCount}건 대량 내보내기` })
      riskScore += 30
    }

    // 업무 시간 외 접근 (UTC 00:00~06:00 = 한국 09:00~15:00 외 접근)
    const offHours = activities.filter((a) => {
      const hour = new Date(a.timestamp).getUTCHours()
      return hour >= 20 || hour < 2  // UTC 20~02시 = 한국 05~11시 제외 야간
    })
    if (offHours.length >= 3) {
      anomalies.push({ type: 'OFF_HOURS_ACCESS', severity: 'MEDIUM', detail: `비정상 시간대 접근 ${offHours.length}건` })
      riskScore += 15
    }

    // 크로스 테넌트 프로빙
    const crossTenantProbes = activities.filter((a) => a.targetTenantId && a.targetTenantId !== tenantId)
    if (crossTenantProbes.length > 0) {
      anomalies.push({ type: 'CROSS_TENANT_PROBE', severity: 'CRITICAL', detail: `타 테넌트 리소스 ${crossTenantProbes.length}회 접근 시도` })
      riskScore += 40
    }

    // 비정상 볼륨: 최근 1시간 내 1000건 이상
    const oneHourAgo = Date.now() - 3_600_000
    const recentCount = activities.filter((a) => a.timestamp >= oneHourAgo).length
    if (recentCount >= 1000) {
      anomalies.push({ type: 'UNUSUAL_VOLUME', severity: 'HIGH', detail: `1시간 내 ${recentCount}건 이상 비정상 요청` })
      riskScore += 25
    }

    riskScore = Math.min(100, riskScore)
    const blocked = anomalies.some((a) => a.severity === 'CRITICAL') || riskScore >= 60

    this.appendAudit('behavior.result', tenantId, { anomalyCount: anomalies.length, riskScore, blocked })

    return { tenantId, anomalies, riskScore, blocked }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, tenantId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, tenantId, detail })
  }
}
