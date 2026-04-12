import { describe, it, expect, beforeEach } from 'vitest'
import { SmartNotificationRouter } from '../smart-notification-router'

describe('SmartNotificationRouter', () => {
  let router: SmartNotificationRouter

  beforeEach(() => {
    router = new SmartNotificationRouter()
    router.registerUser('U1', { channels: ['push', 'email', 'inapp'], quietStart: 22, quietEnd: 8 })
  })

  it('사용자 없으면 delivered=false 반환', () => {
    const result = router.route({ notificationId: 'N1', userId: 'UNKNOWN', title: 't', body: 'b', priority: 'NORMAL' })
    expect(result.delivered).toBe(false)
    expect(result.channel).toBeNull()
  })

  it('방해금지 시간에는 inapp 채널만 선택', () => {
    const result = router.route(
      { notificationId: 'N2', userId: 'U1', title: 't', body: 'b', priority: 'NORMAL' },
      23,  // 22~08 quiet
    )
    expect(result.channel).toBe('inapp')
    expect(result.delivered).toBe(true)
  })

  it('CRITICAL은 방해금지 무시하고 첫 채널로 배달', () => {
    const result = router.route(
      { notificationId: 'N3', userId: 'U1', title: 't', body: 'b', priority: 'CRITICAL' },
      23,
    )
    expect(result.channel).toBe('push')
    expect(result.delivered).toBe(true)
  })

  it('자정 넘김 방해금지 (22~06) 정오는 일반 배달', () => {
    const result = router.route(
      { notificationId: 'N4', userId: 'U1', title: 't', body: 'b', priority: 'NORMAL' },
      12,
    )
    expect(result.channel).toBe('push')
  })

  it('중복 억제 TTL 내 알림 suppressed', () => {
    router.suppressDuplicate('U1', 'key1', 60000)
    const result = router.route({
      notificationId: 'N5', userId: 'U1', title: 't', body: 'b', priority: 'NORMAL', dedupeKey: 'key1',
    })
    expect(result.delivered).toBe(false)
    expect(result.reason).toContain('중복')
  })

  it('배달 이력 조회', () => {
    router.route({ notificationId: 'N6', userId: 'U1', title: 't', body: 'b', priority: 'NORMAL' }, 12)
    const history = router.getDeliveryHistory('U1')
    expect(history.length).toBeGreaterThan(0)
  })

  it('감사 로그 append-only (복사본 반환)', () => {
    router.route({ notificationId: 'N7', userId: 'U1', title: 't', body: 'b', priority: 'HIGH' }, 12)
    const log1 = router.getAuditLog()
    log1.push({ timestamp: '', action: 'injected', userId: 'X', detail: {} })
    const log2 = router.getAuditLog()
    expect(log2.some((e) => e.action === 'injected')).toBe(false)
  })
})
