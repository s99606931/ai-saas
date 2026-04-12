// Design Ref: §R228 — AI기반 멀티테넌트 알림 최적화
// Plan SC: SVC-AI-ADV-R228-SC01

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP'
export type NotificationPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'

export interface TenantPreference {
  tenantId: string
  name: string
  preferredChannels: NotificationChannel[]
  quietHoursStart?: number  // 0~23
  quietHoursEnd?: number    // 0~23
  maxDailyNotifications: number
}

export interface NotificationRequest {
  notificationId: string
  tenantId: string
  subject: string
  body: string
  priority: NotificationPriority
  requestedAt: string
}

export interface DeliveryPlan {
  notificationId: string
  tenantId: string
  selectedChannels: NotificationChannel[]
  scheduledAt: string
  deferred: boolean
  deferReason?: string
  estimatedDeliveryMs: number
}

interface AuditEntry {
  timestamp: string
  action: string
  notificationId: string
  detail: Record<string, unknown>
}

export class MultitenantNotificationOptimizer {
  private tenants = new Map<string, TenantPreference>()
  private dailyCounts = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerTenant(pref: TenantPreference): void {
    this.tenants.set(pref.tenantId, pref)
    this.dailyCounts.set(pref.tenantId, 0)
    this.appendAudit('tenant.register', pref.tenantId, { name: pref.name })
  }

  optimize(request: NotificationRequest): DeliveryPlan {
    const tenant = this.tenants.get(request.tenantId)
    if (!tenant) throw new Error(`Unknown tenant: ${request.tenantId}`)

    this.appendAudit('notification.optimize', request.notificationId, { priority: request.priority })

    const dailyCount = this.dailyCounts.get(request.tenantId) ?? 0
    let deferred = false
    let deferReason: string | undefined

    // 일일 한도 초과 (URGENT 제외)
    if (request.priority !== 'URGENT' && dailyCount >= tenant.maxDailyNotifications) {
      deferred = true
      deferReason = `일일 알림 한도 초과 (${tenant.maxDailyNotifications}건)`
    }

    // 수신 거부 시간 확인 (URGENT 제외)
    if (!deferred && request.priority !== 'URGENT' && tenant.quietHoursStart !== undefined && tenant.quietHoursEnd !== undefined) {
      const requestHour = new Date(request.requestedAt).getUTCHours()
      const inQuietHours = tenant.quietHoursStart <= tenant.quietHoursEnd
        ? requestHour >= tenant.quietHoursStart && requestHour < tenant.quietHoursEnd
        : requestHour >= tenant.quietHoursStart || requestHour < tenant.quietHoursEnd
      if (inQuietHours) {
        deferred = true
        deferReason = `수신 거부 시간 (${tenant.quietHoursStart}~${tenant.quietHoursEnd}시)`
      }
    }

    // 채널 선택: URGENT이면 전체, 아니면 기본 채널
    const selectedChannels: NotificationChannel[] =
      request.priority === 'URGENT'
        ? (['EMAIL', 'SMS', 'PUSH'] as NotificationChannel[])
        : tenant.preferredChannels.slice(0, 2)

    if (!deferred) {
      this.dailyCounts.set(request.tenantId, dailyCount + 1)
    }

    const estimatedDeliveryMs =
      request.priority === 'URGENT' ? 100
        : request.priority === 'HIGH' ? 1000
        : 5000

    this.appendAudit('notification.plan', request.notificationId, { deferred, channels: selectedChannels.length })

    return {
      notificationId: request.notificationId,
      tenantId: request.tenantId,
      selectedChannels,
      scheduledAt: new Date().toISOString(),
      deferred,
      deferReason,
      estimatedDeliveryMs,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, notificationId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, notificationId, detail })
  }
}
