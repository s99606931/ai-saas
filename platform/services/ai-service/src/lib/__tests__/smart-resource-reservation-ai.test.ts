// Plan SC: SVC-AI-ADV-R398-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { SmartResourceReservationAI, type Resource, type ReservationRequest } from '../smart-resource-reservation-ai'

describe('SmartResourceReservationAI', () => {
  let manager: SmartResourceReservationAI

  const room: Resource = {
    resourceId: 'ROOM-1',
    name: '대회의실',
    type: 'MEETING_ROOM',
    capacity: 20,
    available: true,
    tags: ['projector', 'whiteboard'],
  }

  const request: ReservationRequest = {
    requestId: 'REQ-1',
    userId: 'USER-1',
    resourceType: 'MEETING_ROOM',
    requiredCapacity: 10,
    startTime: Date.now() + 3600_000,
    endTime: Date.now() + 7200_000,
    priority: 'NORMAL',
  }

  beforeEach(() => {
    manager = new SmartResourceReservationAI()
    manager.registerResource(room)
  })

  it('정상 예약 → CONFIRMED', () => {
    const result = manager.reserve(request)
    expect(result.status).toBe('CONFIRMED')
    expect(result.assignedResourceId).toBe('ROOM-1')
  })

  it('종료 시각 <= 시작 시각 → REJECTED', () => {
    const result = manager.reserve({ ...request, requestId: 'REQ-BAD', endTime: request.startTime - 1000 })
    expect(result.status).toBe('REJECTED')
  })

  it('가용 리소스 없을 때 → WAITLISTED', () => {
    manager.reserve(request)
    const result = manager.reserve({ ...request, requestId: 'REQ-2', userId: 'USER-2' })
    expect(result.status).toBe('WAITLISTED')
    expect(result.waitlistPosition).toBeDefined()
  })

  it('URGENT 우선순위 → 대기열 1번 위치', () => {
    // 리소스 1개 점유 후 2개 대기열 등록 (NORMAL 먼저, URGENT 나중)
    manager.reserve(request)
    // NORMAL은 대기열 2번 (waitlist.length=0 → position=1), URGENT는 position=1 고정
    // 두 번째 NORMAL은 대기열 2번
    manager.reserve({ ...request, requestId: 'REQ-NML1', userId: 'USER-N1' })
    const normalResult = manager.reserve({ ...request, requestId: 'REQ-NML2', userId: 'USER-N2' })
    const urgentResult = manager.reserve({ ...request, requestId: 'REQ-URG', userId: 'USER-U', priority: 'URGENT' })
    expect(urgentResult.waitlistPosition).toBe(1)
    expect(urgentResult.status).toBe('WAITLISTED')
    expect(normalResult.status).toBe('WAITLISTED')
  })

  it('예약 취소', () => {
    manager.reserve(request)
    const cancelled = manager.cancel('REQ-1', 'USER-1')
    expect(cancelled).toBe(true)
  })

  it('존재하지 않는 예약 취소 시 false 반환', () => {
    const result = manager.cancel('NONE', 'USER-X')
    expect(result).toBe(false)
  })

  it('태그 필터: 매칭 태그 없으면 WAITLISTED', () => {
    const result = manager.reserve({ ...request, requestId: 'REQ-TAG', tags: ['nonexistent-tag'] })
    expect(result.status).toBe('WAITLISTED')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    manager.reserve(request)
    const log1 = manager.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', requestId: 'X', detail: {} })
    const log2 = manager.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
