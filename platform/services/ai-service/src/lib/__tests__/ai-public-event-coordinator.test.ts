import { describe, it, expect, beforeEach } from 'vitest'
import { AiPublicEventCoordinator } from '../ai-public-event-coordinator.js'

describe('AiPublicEventCoordinator (FR-R505.1)', () => {
  let svc: AiPublicEventCoordinator

  beforeEach(() => {
    svc = new AiPublicEventCoordinator()
  })

  it('모든 자원 충족 → READY', () => {
    svc.registerEvent(
      {
        eventId: 'E1',
        name: '시민의 날',
        date: '2026-06-01',
        expectedAttendance: 500,
        resources: [
          { resourceId: 'V1', type: 'VENUE', required: 1, available: 1 },
          { resourceId: 'S1', type: 'STAFF', required: 10, available: 12 },
          { resourceId: 'P1', type: 'PERMIT', required: 1, available: 1 },
        ],
      },
      'O'
    )
    const r = svc.coordinate('E1')
    expect(r.status).toBe('READY')
    expect(r.readinessPct).toBe(100)
  })

  it('PERMIT 부족 → BLOCKED', () => {
    svc.registerEvent(
      {
        eventId: 'E2',
        name: '축제',
        date: '2026-07-01',
        expectedAttendance: 2000,
        resources: [
          { resourceId: 'V1', type: 'VENUE', required: 1, available: 1 },
          { resourceId: 'P1', type: 'PERMIT', required: 1, available: 0 },
        ],
      },
      'O'
    )
    const r = svc.coordinate('E2')
    expect(r.status).toBe('BLOCKED')
    expect(r.blockers.some((b) => b.startsWith('PERMIT'))).toBe(true)
  })

  it('일부 자원 부족 → ATTENTION', () => {
    svc.registerEvent(
      {
        eventId: 'E3',
        name: '소규모 행사',
        date: '2026-05-01',
        expectedAttendance: 100,
        resources: [
          { resourceId: 'V1', type: 'VENUE', required: 1, available: 1 },
          { resourceId: 'S1', type: 'STAFF', required: 10, available: 8 },
          { resourceId: 'E1', type: 'EQUIPMENT', required: 5, available: 5 },
        ],
      },
      'O'
    )
    const r = svc.coordinate('E3')
    expect(r.status).toBe('ATTENTION')
  })

  it('대규모 행사 + 부족 → 안전관리계획 권고', () => {
    svc.registerEvent(
      {
        eventId: 'E4',
        name: '대규모 콘서트',
        date: '2026-08-01',
        expectedAttendance: 5000,
        resources: [
          { resourceId: 'S1', type: 'STAFF', required: 50, available: 30 },
        ],
      },
      'O'
    )
    const r = svc.coordinate('E4')
    expect(r.recommendations.some((x) => x.includes('안전관리'))).toBe(true)
  })

  it('S 등급 차단', () => {
    expect(() =>
      svc.registerEvent(
        {
          eventId: 'E5',
          name: '비공개',
          date: '2026-09-01',
          expectedAttendance: 100,
          resources: [],
        },
        'S'
      )
    ).toThrow(/BLOCKED/)
  })

  it('감사 로그 기록', () => {
    svc.registerEvent(
      {
        eventId: 'E6',
        name: '미니',
        date: '2026-05-01',
        expectedAttendance: 50,
        resources: [{ resourceId: 'V1', type: 'VENUE', required: 1, available: 1 }],
      },
      'O'
    )
    svc.coordinate('E6')
    expect(svc.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
