/**
 * Smart Notification Router — SVC-AI-ADV-R146 (트랙 B 3차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R146-R153-trackB/SVC-AI-ADV-R146.design.md
 * Plan SC: FR-R146.1 ~ FR-R146.5
 *
 * 사용자 컨텍스트/시간대/채널 기반 알림 최적 배달 라우팅.
 * 외부 API 없음 — 규칙 기반.
 */

// Design Ref: §2 — 타입 정의

export type Channel = 'email' | 'sms' | 'push' | 'inapp'
export type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW'

export interface UserPreferences {
  userId: string
  channels: Channel[]
  quietStart: number  // 0-23 시
  quietEnd: number    // 0-23 시
}

export interface Notification {
  notificationId: string
  userId: string
  title: string
  body: string
  priority: Priority
  dedupeKey?: string
}

export interface DeliveryResult {
  notificationId: string
  channel: Channel | null
  delivered: boolean
  reason: string
  routedAt: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  userId: string
  detail: Record<string, unknown>
}

export class SmartNotificationRouter {
  private readonly preferences = new Map<string, UserPreferences>()
  private readonly deliveryHistory = new Map<string, DeliveryResult[]>()
  private readonly dedupeCache = new Map<string, number>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R146.1
  registerUser(userId: string, preferences: Omit<UserPreferences, 'userId'>): void {
    this.preferences.set(userId, { ...preferences, userId })
    this.deliveryHistory.set(userId, [])
  }

  // Plan SC: FR-R146.2 — Design Ref: §3.1 채널 선택, §3.2 방해금지
  route(notification: Notification, nowHour?: number): DeliveryResult {
    const prefs = this.preferences.get(notification.userId)
    if (!prefs) {
      const result: DeliveryResult = {
        notificationId: notification.notificationId,
        channel: null,
        delivered: false,
        reason: '사용자 설정 없음',
        routedAt: new Date().toISOString(),
      }
      this.appendAudit('notification.route', notification.userId, { delivered: false })
      return result
    }

    // 중복 억제 검사
    if (notification.dedupeKey) {
      const key = `${notification.userId}:${notification.dedupeKey}`
      const expiry = this.dedupeCache.get(key) ?? 0
      if (Date.now() < expiry) {
        const result: DeliveryResult = {
          notificationId: notification.notificationId,
          channel: null,
          delivered: false,
          reason: '중복 알림 억제',
          routedAt: new Date().toISOString(),
        }
        this.appendAudit('notification.suppressed', notification.userId, { key })
        return result
      }
    }

    const hour = nowHour ?? new Date().getHours()
    const isQuiet = this.isQuietHour(hour, prefs.quietStart, prefs.quietEnd)

    // CRITICAL은 방해금지 무시
    let selectedChannel: Channel | null = null
    if (notification.priority === 'CRITICAL') {
      selectedChannel = prefs.channels[0] ?? 'inapp'
    } else if (isQuiet) {
      selectedChannel = prefs.channels.includes('inapp') ? 'inapp' : null
    } else {
      selectedChannel = prefs.channels[0] ?? null
    }

    const result: DeliveryResult = {
      notificationId: notification.notificationId,
      channel: selectedChannel,
      delivered: selectedChannel !== null,
      reason: selectedChannel ? `${selectedChannel} 채널로 배달` : '사용 가능한 채널 없음',
      routedAt: new Date().toISOString(),
    }

    const history = this.deliveryHistory.get(notification.userId) ?? []
    history.push(result)
    this.deliveryHistory.set(notification.userId, history)
    this.appendAudit('notification.route', notification.userId, {
      channel: selectedChannel,
      priority: notification.priority,
    })
    return result
  }

  // Plan SC: FR-R146.3 — Design Ref: §3.3 중복 억제
  suppressDuplicate(userId: string, key: string, ttlMs: number): void {
    const cacheKey = `${userId}:${key}`
    this.dedupeCache.set(cacheKey, Date.now() + ttlMs)
  }

  // Plan SC: FR-R146.4
  getDeliveryHistory(userId: string): DeliveryResult[] {
    return [...(this.deliveryHistory.get(userId) ?? [])]
  }

  // Plan SC: FR-R146.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private isQuietHour(hour: number, start: number, end: number): boolean {
    if (start <= end) return hour >= start && hour < end
    // 자정 넘김 (예: 22~06)
    return hour >= start || hour < end
  }

  private appendAudit(action: string, userId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, userId, detail })
  }
}
