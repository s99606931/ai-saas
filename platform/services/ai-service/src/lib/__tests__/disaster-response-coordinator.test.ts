import { describe, it, expect, beforeEach } from 'vitest'
import { DisasterResponseCoordinator } from '../disaster-response-coordinator'

describe('DisasterResponseCoordinator', () => {
  let coord: DisasterResponseCoordinator

  beforeEach(() => {
    coord = new DisasterResponseCoordinator()
    coord.registerEvent(
      {
        eventId: 'ev-1',
        type: 'FLOOD',
        locationCode: 'SEOUL-GANGNAM',
        affectedCount: 500,
        occurredAt: '2026-04-13T10:00:00Z',
      },
      'operator-a',
      'O'
    )
  })

  it('C등급 호출 차단', () => {
    expect(() =>
      coord.registerEvent(
        { eventId: 'x', type: 'FIRE', locationCode: 'L', affectedCount: 1, occurredAt: 'now' },
        'op',
        'C'
      )
    ).toThrow('BLOCKED')
  })

  it('affectedCount 음수 차단', () => {
    expect(() =>
      coord.registerEvent(
        { eventId: 'x', type: 'FIRE', locationCode: 'L', affectedCount: -1, occurredAt: 'now' },
        'op',
        'O'
      )
    ).toThrow('affectedCount')
  })

  it('중복 이벤트 차단', () => {
    expect(() =>
      coord.registerEvent(
        {
          eventId: 'ev-1',
          type: 'FLOOD',
          locationCode: 'L',
          affectedCount: 1,
          occurredAt: 'now',
        },
        'op',
        'O'
      )
    ).toThrow('중복')
  })

  it('심각도 분류 — MEDIUM', () => {
    expect(coord.classifySeverity('ev-1')).toBe('MEDIUM')
  })

  it('심각도 분류 — LOW/HIGH/CRITICAL 경계', () => {
    coord.registerEvent(
      { eventId: 'low', type: 'FIRE', locationCode: 'L', affectedCount: 99, occurredAt: 'now' },
      'op',
      'O'
    )
    coord.registerEvent(
      { eventId: 'high', type: 'FIRE', locationCode: 'L', affectedCount: 5000, occurredAt: 'now' },
      'op',
      'O'
    )
    coord.registerEvent(
      {
        eventId: 'crit',
        type: 'EARTHQUAKE',
        locationCode: 'L',
        affectedCount: 20000,
        occurredAt: 'now',
      },
      'op',
      'O'
    )
    expect(coord.classifySeverity('low')).toBe('LOW')
    expect(coord.classifySeverity('high')).toBe('HIGH')
    expect(coord.classifySeverity('crit')).toBe('CRITICAL')
  })

  it('대피소 용량 검증', () => {
    expect(() =>
      coord.registerShelter({
        shelterId: 's1',
        locationCode: 'L',
        capacity: 0,
        currentOccupancy: 0,
      })
    ).toThrow('capacity')
    expect(() =>
      coord.registerShelter({
        shelterId: 's1',
        locationCode: 'L',
        capacity: 100,
        currentOccupancy: 200,
      })
    ).toThrow('currentOccupancy')
  })

  it('동일 지역 우선 배분', () => {
    coord.registerShelter({
      shelterId: 's-local',
      locationCode: 'SEOUL-GANGNAM',
      capacity: 300,
      currentOccupancy: 0,
    })
    coord.registerShelter({
      shelterId: 's-far',
      locationCode: 'BUSAN',
      capacity: 1000,
      currentOccupancy: 0,
    })
    const result = coord.allocateShelter('ev-1')
    expect(result.allocations.length).toBe(1)
    expect(result.allocations[0]?.shelterId).toBe('s-local')
    expect(result.allocations[0]?.assignedCount).toBe(300)
    expect(result.shortage).toBe(200)
  })

  it('지역 없을 때 전체 풀에서 여유 순 배분', () => {
    coord.registerShelter({
      shelterId: 's-a',
      locationCode: 'OTHER-1',
      capacity: 100,
      currentOccupancy: 50,
    })
    coord.registerShelter({
      shelterId: 's-b',
      locationCode: 'OTHER-2',
      capacity: 500,
      currentOccupancy: 100,
    })
    const result = coord.allocateShelter('ev-1')
    // 여유 큰 s-b (400) 먼저 → 400 할당, 남은 100은 s-a (50) 처리
    expect(result.allocations[0]?.shelterId).toBe('s-b')
    expect(result.allocations[0]?.assignedCount).toBe(400)
    expect(result.allocations[1]?.shelterId).toBe('s-a')
    expect(result.allocations[1]?.assignedCount).toBe(50)
    expect(result.shortage).toBe(50)
  })

  it('자원 계획 — MEDIUM 값', () => {
    const plan = coord.planResources('ev-1')
    expect(plan.severity).toBe('MEDIUM')
    expect(plan.medicalKits).toBe(50)
    expect(plan.foodPacks).toBe(500)
    expect(plan.waterLiters).toBe(1000)
    expect(plan.reliefKits).toBe(200)
  })

  it('시민 경보 — WATCH 레벨', () => {
    const alert = coord.issueAlert('ev-1')
    expect(alert.alertLevel).toBe('WATCH')
    expect(alert.targetLocationCode).toBe('SEOUL-GANGNAM')
    expect(alert.message).toContain('FLOOD')
  })

  it('CRITICAL → EMERGENCY', () => {
    coord.registerEvent(
      {
        eventId: 'mega',
        type: 'TYPHOON',
        locationCode: 'L',
        affectedCount: 50000,
        occurredAt: 'now',
      },
      'op',
      'O'
    )
    const alert = coord.issueAlert('mega')
    expect(alert.alertLevel).toBe('EMERGENCY')
  })

  it('감사 로그 — caller 마스킹', () => {
    const log = coord.getAuditLog()
    const regLog = log.find((e) => e.action === 'event.register')
    expect(regLog?.callerMasked).toContain('***')
    expect(regLog?.callerMasked).not.toBe('operator-a')
  })

  it('Unknown event 조회 오류', () => {
    expect(() => coord.classifySeverity('none')).toThrow('Unknown')
    expect(() => coord.allocateShelter('none')).toThrow('Unknown')
    expect(() => coord.issueAlert('none')).toThrow('Unknown')
  })
})
