// Design Ref: §R338 — AI기반 멀티테넌트 쿼터 관리
// Plan SC: SC-R338

export interface TenantQuota {
  tenantId: string
  orgName: string
  maxApiCallsPerHour: number
  maxStorageGb: number
  maxConcurrentUsers: number
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM'
}

export interface QuotaUsage {
  tenantId: string
  timestamp: number
  apiCallsThisHour: number
  storageUsedGb: number
  concurrentUsers: number
}

export type QuotaStatus = 'NORMAL' | 'WARNING' | 'EXCEEDED' | 'THROTTLED'

export interface QuotaReport {
  tenantId: string
  orgName: string
  tier: TenantQuota['tier']
  apiCallStatus: QuotaStatus
  storageStatus: QuotaStatus
  concurrentUserStatus: QuotaStatus
  overallStatus: QuotaStatus
  usagePercents: { apiCalls: number; storage: number; concurrentUsers: number }
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function computeStatus(used: number, max: number): QuotaStatus {
  const pct = used / Math.max(max, 1)
  if (pct >= 1.0) return 'EXCEEDED'
  if (pct >= 0.9) return 'THROTTLED'
  if (pct >= 0.75) return 'WARNING'
  return 'NORMAL'
}

const STATUS_PRIORITY: Record<QuotaStatus, number> = { EXCEEDED: 4, THROTTLED: 3, WARNING: 2, NORMAL: 1 }

export class MultitenantQuotaManagerAi {
  private quotas = new Map<string, TenantQuota>()
  private usages = new Map<string, QuotaUsage[]>()
  private auditLog: AuditEntry[] = []

  registerTenant(quota: TenantQuota): void {
    this.quotas.set(quota.tenantId, quota)
    this.usages.set(quota.tenantId, [])
    this.auditLog.push({ action: 'tenant.register', timestamp: new Date().toISOString(), detail: quota.tenantId })
  }

  recordUsage(usage: QuotaUsage): void {
    if (!this.quotas.has(usage.tenantId)) throw new Error(`Tenant not found: ${usage.tenantId}`)
    this.usages.get(usage.tenantId)!.push(usage)
    this.auditLog.push({ action: 'usage.record', timestamp: new Date().toISOString(), detail: usage.tenantId })
  }

  report(tenantId: string): QuotaReport {
    const quota = this.quotas.get(tenantId)
    if (!quota) throw new Error(`Tenant not found: ${tenantId}`)

    const records = this.usages.get(tenantId) ?? []
    const latest = records[records.length - 1]

    const apiCalls = latest?.apiCallsThisHour ?? 0
    const storage = latest?.storageUsedGb ?? 0
    const concurrentUsers = latest?.concurrentUsers ?? 0

    const apiCallStatus = computeStatus(apiCalls, quota.maxApiCallsPerHour)
    const storageStatus = computeStatus(storage, quota.maxStorageGb)
    const concurrentUserStatus = computeStatus(concurrentUsers, quota.maxConcurrentUsers)

    const statuses = [apiCallStatus, storageStatus, concurrentUserStatus]
    const overallStatus = statuses.reduce((max, s) => STATUS_PRIORITY[s] > STATUS_PRIORITY[max] ? s : max, 'NORMAL' as QuotaStatus)

    const recommendations: string[] = []
    if (apiCallStatus === 'EXCEEDED') recommendations.push('API 호출 한도 초과 — 쿼터 증설 또는 티어 업그레이드 필요')
    if (storageStatus === 'WARNING' || storageStatus === 'EXCEEDED') recommendations.push('스토리지 사용량 증가 — 데이터 정리 또는 용량 증설 필요')
    if (overallStatus === 'EXCEEDED' && quota.tier !== 'PREMIUM') recommendations.push(`${quota.tier} → PREMIUM 업그레이드 검토`)

    this.auditLog.push({ action: 'quota.report', timestamp: new Date().toISOString(), detail: `${tenantId}:${overallStatus}` })
    return {
      tenantId,
      orgName: quota.orgName,
      tier: quota.tier,
      apiCallStatus,
      storageStatus,
      concurrentUserStatus,
      overallStatus,
      usagePercents: {
        apiCalls: Math.round((apiCalls / Math.max(quota.maxApiCallsPerHour, 1)) * 100),
        storage: Math.round((storage / Math.max(quota.maxStorageGb, 1)) * 100),
        concurrentUsers: Math.round((concurrentUsers / Math.max(quota.maxConcurrentUsers, 1)) * 100),
      },
      recommendations,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
