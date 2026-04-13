import { describe, it, expect, beforeEach } from 'vitest'
import { AiParkMaintenanceScheduler } from '../ai-park-maintenance-scheduler.js'

describe('AiParkMaintenanceScheduler (FR-R509.1)', () => {
  let svc: AiParkMaintenanceScheduler

  beforeEach(() => {
    svc = new AiParkMaintenanceScheduler()
  })

  it('정기 유지관리 — ROUTINE', () => {
    svc.registerPark(
      {
        parkId: 'P1',
        area: 5000,
        treeCount: 30,
        lastMowedDays: 5,
        lastPrunedDays: 30,
        lastInspectedDays: 10,
        visitorPerDay: 50,
      },
      'O'
    )
    const sch = svc.schedule('P1')
    expect(sch.items.some((i) => i.task === 'MOWING' && i.urgency === 'ROUTINE')).toBe(true)
  })

  it('잔디 오래됨 → URGENT', () => {
    svc.registerPark(
      {
        parkId: 'P2',
        area: 3000,
        treeCount: 0,
        lastMowedDays: 30,
        lastPrunedDays: 0,
        lastInspectedDays: 5,
        visitorPerDay: 10,
      },
      'O'
    )
    const sch = svc.schedule('P2')
    const mowing = sch.items.find((i) => i.task === 'MOWING')
    expect(mowing?.urgency).toBe('URGENT')
  })

  it('나무 없으면 PRUNING 제외', () => {
    svc.registerPark(
      {
        parkId: 'P3',
        area: 2000,
        treeCount: 0,
        lastMowedDays: 5,
        lastPrunedDays: 10,
        lastInspectedDays: 5,
        visitorPerDay: 30,
      },
      'O'
    )
    const sch = svc.schedule('P3')
    expect(sch.items.find((i) => i.task === 'PRUNING')).toBeUndefined()
  })

  it('방문자 많음 → CLEANING URGENT', () => {
    svc.registerPark(
      {
        parkId: 'P4',
        area: 10000,
        treeCount: 50,
        lastMowedDays: 5,
        lastPrunedDays: 30,
        lastInspectedDays: 10,
        visitorPerDay: 600,
      },
      'O'
    )
    const sch = svc.schedule('P4')
    const cleaning = sch.items.find((i) => i.task === 'CLEANING')
    expect(cleaning).toBeDefined()
    expect(cleaning?.urgency).toBe('URGENT')
  })

  it('S 등급 차단', () => {
    expect(() =>
      svc.registerPark(
        {
          parkId: 'P5',
          area: 1000,
          treeCount: 5,
          lastMowedDays: 1,
          lastPrunedDays: 1,
          lastInspectedDays: 1,
          visitorPerDay: 1,
        },
        'S'
      )
    ).toThrow(/BLOCKED/)
  })

  it('감사 로그 + 총 작업 시간', () => {
    svc.registerPark(
      {
        parkId: 'P6',
        area: 4000,
        treeCount: 20,
        lastMowedDays: 7,
        lastPrunedDays: 60,
        lastInspectedDays: 15,
        visitorPerDay: 100,
      },
      'O'
    )
    const sch = svc.schedule('P6')
    expect(sch.totalHours).toBeGreaterThan(0)
    expect(svc.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
