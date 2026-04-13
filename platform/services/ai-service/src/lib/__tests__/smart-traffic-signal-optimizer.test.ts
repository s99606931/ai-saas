import { describe, it, expect, beforeEach } from 'vitest'
import { SmartTrafficSignalOptimizer } from '../smart-traffic-signal-optimizer.js'

describe('SmartTrafficSignalOptimizer (FR-R504.1)', () => {
  let svc: SmartTrafficSignalOptimizer

  beforeEach(() => {
    svc = new SmartTrafficSignalOptimizer()
    svc.registerIntersection({
      intersectionId: 'I1',
      minGreenSec: 20,
      maxGreenSec: 60,
      yellowSec: 5,
    })
  })

  it('남북 우세 시 NORTH_SOUTH 선택', () => {
    const plan = svc.optimize(
      {
        intersectionId: 'I1',
        northSouthVehicles: 50,
        eastWestVehicles: 10,
        pedestriansWaiting: 0,
        timestamp: '2026-04-13T10:00:00Z',
      },
      'O'
    )
    expect(plan.phase).toBe('NORTH_SOUTH')
    expect(plan.greenSec).toBeGreaterThanOrEqual(20)
    expect(plan.greenSec).toBeLessThanOrEqual(60)
  })

  it('동서 우세 시 EAST_WEST 선택', () => {
    const plan = svc.optimize(
      {
        intersectionId: 'I1',
        northSouthVehicles: 5,
        eastWestVehicles: 80,
        pedestriansWaiting: 0,
        timestamp: '2026-04-13T10:00:00Z',
      },
      'O'
    )
    expect(plan.phase).toBe('EAST_WEST')
  })

  it('교통량 0 — 기본 사이클', () => {
    const plan = svc.optimize(
      {
        intersectionId: 'I1',
        northSouthVehicles: 0,
        eastWestVehicles: 0,
        pedestriansWaiting: 0,
        timestamp: '2026-04-13T03:00:00Z',
      },
      'O'
    )
    expect(plan.greenSec).toBe(20)
    expect(plan.cycleSec).toBe(25)
  })

  it('보행자 많음 — 녹색 단축', () => {
    const noPedestrians = svc.optimize(
      {
        intersectionId: 'I1',
        northSouthVehicles: 100,
        eastWestVehicles: 10,
        pedestriansWaiting: 0,
        timestamp: '2026-04-13T10:00:00Z',
      },
      'O'
    )
    const manyPedestrians = svc.optimize(
      {
        intersectionId: 'I1',
        northSouthVehicles: 100,
        eastWestVehicles: 10,
        pedestriansWaiting: 50,
        timestamp: '2026-04-13T10:00:00Z',
      },
      'O'
    )
    expect(manyPedestrians.greenSec).toBeLessThanOrEqual(noPedestrians.greenSec)
  })

  it('C 등급 차단', () => {
    expect(() =>
      svc.optimize(
        {
          intersectionId: 'I1',
          northSouthVehicles: 10,
          eastWestVehicles: 10,
          pedestriansWaiting: 0,
          timestamp: '2026-04-13T10:00:00Z',
        },
        'C'
      )
    ).toThrow(/BLOCKED/)
  })

  it('감사 로그 기록', () => {
    svc.optimize(
      {
        intersectionId: 'I1',
        northSouthVehicles: 30,
        eastWestVehicles: 30,
        pedestriansWaiting: 5,
        timestamp: '2026-04-13T10:00:00Z',
      },
      'O'
    )
    expect(svc.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
