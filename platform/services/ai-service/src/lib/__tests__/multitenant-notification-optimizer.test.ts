import { describe, it, expect, beforeEach } from 'vitest'
import { MultitenantNotificationOptimizer } from '../multitenant-notification-optimizer'

describe('MultitenantNotificationOptimizer', () => {
  let optimizer: MultitenantNotificationOptimizer

  beforeEach(() => {
    optimizer = new MultitenantNotificationOptimizer()
    optimizer.registerTenant({ tenantId: 'T-1', name: 'A기관', preferredChannels: ['EMAIL', 'IN_APP'], maxDailyNotifications: 3 })
  })

  it('알 수 없는 테넌트 오류', () => {
    expect(() => optimizer.optimize({ notificationId: 'N-1', tenantId: 'UNKNOWN', subject: '제목', body: '내용', priority: 'NORMAL', requestedAt: new Date().toISOString() })).toThrow('Unknown tenant')
  })

  it('정상 알림 전송 계획 생성', () => {
    const plan = optimizer.optimize({ notificationId: 'N-2', tenantId: 'T-1', subject: '공지', body: '내용', priority: 'NORMAL', requestedAt: new Date().toISOString() })
    expect(plan.deferred).toBe(false)
    expect(plan.selectedChannels.length).toBeGreaterThan(0)
  })

  it('일일 한도 초과 — 지연', () => {
    for (let i = 0; i < 3; i++) {
      optimizer.optimize({ notificationId: `N-${i + 10}`, tenantId: 'T-1', subject: '공지', body: '내용', priority: 'NORMAL', requestedAt: new Date().toISOString() })
    }
    const plan = optimizer.optimize({ notificationId: 'N-99', tenantId: 'T-1', subject: '4번째', body: '내용', priority: 'NORMAL', requestedAt: new Date().toISOString() })
    expect(plan.deferred).toBe(true)
    expect(plan.deferReason).toContain('한도')
  })

  it('URGENT 알림 — 한도 초과에도 전송', () => {
    for (let i = 0; i < 3; i++) {
      optimizer.optimize({ notificationId: `N-${i + 20}`, tenantId: 'T-1', subject: '공지', body: '내용', priority: 'NORMAL', requestedAt: new Date().toISOString() })
    }
    const plan = optimizer.optimize({ notificationId: 'N-URGENT', tenantId: 'T-1', subject: '긴급', body: '긴급 내용', priority: 'URGENT', requestedAt: new Date().toISOString() })
    expect(plan.deferred).toBe(false)
    expect(plan.selectedChannels).toContain('SMS')
  })

  it('URGENT 알림 — 빠른 예상 전송 시간', () => {
    const plan = optimizer.optimize({ notificationId: 'N-FAST', tenantId: 'T-1', subject: '긴급', body: '내용', priority: 'URGENT', requestedAt: new Date().toISOString() })
    expect(plan.estimatedDeliveryMs).toBe(100)
  })

  it('감사 로그 복사본 반환', () => {
    optimizer.optimize({ notificationId: 'N-LOG', tenantId: 'T-1', subject: '공지', body: '내용', priority: 'NORMAL', requestedAt: new Date().toISOString() })
    const log = optimizer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', notificationId: 'X', detail: {} })
    expect(optimizer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
