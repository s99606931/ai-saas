// Design Ref: §R422 — Smart Parking Allocator AI
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceDemandPredictorV2 } from '../public-service-demand-predictor-v2'

describe('PublicServiceDemandPredictorV2 (Parking Allocator)', () => {
  let allocator: PublicServiceDemandPredictorV2

  beforeEach(() => {
    allocator = new PublicServiceDemandPredictorV2()
    allocator.registerSlot({ slotId: 'S01', distanceFromEntrance: 10, occupied: false })
    allocator.registerSlot({ slotId: 'S02', distanceFromEntrance: 20, occupied: false })
    allocator.registerSlot({ slotId: 'S03', distanceFromEntrance: 30, occupied: false })
  })

  it('nearest-fit: 가장 가까운 슬롯 배정', () => {
    const result = allocator.allocate({ requestId: 'REQ-001', priority: 'VISITOR' })
    expect(result.assigned).toBe('S01')
    expect(result.reason).toBe('ALLOCATED')
  })

  it('NO_SLOT: 가용 슬롯 없음', () => {
    allocator.allocate({ requestId: 'REQ-002', priority: 'STAFF' })
    allocator.allocate({ requestId: 'REQ-003', priority: 'STAFF' })
    allocator.allocate({ requestId: 'REQ-004', priority: 'STAFF' })
    const result = allocator.allocate({ requestId: 'REQ-005', priority: 'VISITOR' })
    expect(result.assigned).toBeNull()
    expect(result.reason).toBe('NO_SLOT')
  })

  it('SATURATED: 활용률 90% 초과 시 alert', () => {
    // 3개 중 2개 배정 후 빈 슬롯 1개 남기고 새로운 슬롯이 없는 경우
    // 11개 슬롯 + 1개: 11/12 > 0.9
    const bigAllocator = new PublicServiceDemandPredictorV2()
    for (let i = 1; i <= 12; i++) {
      bigAllocator.registerSlot({ slotId: `BIG-${i}`, distanceFromEntrance: i * 5, occupied: i <= 11 })
    }
    const result = bigAllocator.allocate({ requestId: 'REQ-SAT', priority: 'EMERGENCY' })
    expect(result.alert).toBe('SATURATED')
  })

  it('EMERGENCY 우선순위 배정 정상 동작', () => {
    const result = allocator.allocate({ requestId: 'REQ-EMG', priority: 'EMERGENCY' })
    expect(result.assigned).not.toBeNull()
  })

  it('DISABLED 우선순위 배정', () => {
    const result = allocator.allocate({ requestId: 'REQ-DIS', priority: 'DISABLED' })
    expect(result.assigned).toBe('S01')
  })

  it('연속 배정: 두 번째는 다음 슬롯', () => {
    allocator.allocate({ requestId: 'REQ-A', priority: 'VISITOR' })
    const second = allocator.allocate({ requestId: 'REQ-B', priority: 'VISITOR' })
    expect(second.assigned).toBe('S02')
  })

  it('감사 로그에 parking.allocate 기록', () => {
    allocator.allocate({ requestId: 'REQ-LOG', priority: 'STAFF' })
    const logs = allocator.getAuditLog()
    expect(logs.some((l) => l.action === 'parking.allocate')).toBe(true)
  })
})
