import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceNotificationV2, type NotificationTemplate, type NotificationEvent } from '../public-service-notification-v2'

describe('PublicServiceNotificationV2', () => {
  let notifier: PublicServiceNotificationV2

  const template: NotificationTemplate = {
    templateId: 'TPL001',
    eventType: 'CIVIL_COMPLAINT_RECEIVED',
    channel: 'SMS',
    titleTemplate: '민원 접수 알림',
    bodyTemplate: '{{userName}}님의 민원({{complaintId}})이 접수되었습니다.',
    priority: 'HIGH',
  }

  const event: NotificationEvent = {
    eventId: 'EVT001',
    eventType: 'CIVIL_COMPLAINT_RECEIVED',
    userId: 'USR0012345',
    variables: { userName: '홍길동', complaintId: 'CMP-2026-001' },
    timestamp: Date.now(),
  }

  beforeEach(() => {
    notifier = new PublicServiceNotificationV2()
    notifier.registerTemplate(template)
  })

  it('템플릿 등록 감사 로그', () => {
    const log = notifier.getAuditLog()
    expect(log.some((e) => e.action === 'template.register')).toBe(true)
  })

  it('정상 발송 → status QUEUED, 채널 SMS', () => {
    const result = notifier.dispatch(event)
    expect(result.status).toBe('QUEUED')
    expect(result.channel).toBe('SMS')
  })

  it('템플릿 변수 렌더링', () => {
    const result = notifier.dispatch(event)
    expect(result.body).toContain('홍길동')
    expect(result.body).toContain('CMP-2026-001')
  })

  it('userId 마스킹 — 원본 노출 없음', () => {
    const result = notifier.dispatch(event)
    expect(result.maskedUserId).not.toBe(result.userId)
    expect(result.maskedUserId.includes('*')).toBe(true)
  })

  it('userId 마스킹 형식: 앞2 + *** + 뒤2', () => {
    const result = notifier.dispatch(event)
    // 'USR0012345' → 'US*****45'
    expect(result.maskedUserId.startsWith('US')).toBe(true)
    expect(result.maskedUserId.endsWith('45')).toBe(true)
  })

  it('템플릿 없는 이벤트 → SKIPPED_NO_TEMPLATE', () => {
    const result = notifier.dispatch({ ...event, eventType: 'UNKNOWN_EVENT' })
    expect(result.status).toBe('SKIPPED_NO_TEMPLATE')
  })

  it('배치 발송 결과 집계', () => {
    const events: NotificationEvent[] = [
      event,
      { ...event, eventId: 'EVT002' },
      { ...event, eventId: 'EVT003', eventType: 'UNKNOWN' },
    ]
    const batchResult = notifier.dispatchBatch(events)
    expect(batchResult.totalEvents).toBe(3)
    expect(batchResult.queuedCount).toBe(2)
    expect(batchResult.skippedCount).toBe(1)
  })

  it('발송 후 감사 로그', () => {
    notifier.dispatch(event)
    const log = notifier.getAuditLog()
    expect(log.some((e) => e.action === 'notification.dispatch')).toBe(true)
  })
})
