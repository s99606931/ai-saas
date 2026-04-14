// Plan SC: SVC-AI-ADV-R485-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceBookingOptimizerAI, type ServiceSlot, type BookingRequest } from '../public-service-booking-optimizer-ai'

describe('PublicServiceBookingOptimizerAI', () => {
  let optimizer: PublicServiceBookingOptimizerAI

  const slot: ServiceSlot = {
    slotId: 'SL-1',
    serviceId: 'SVC-CIVIL',
    serviceType: 'CIVIL',
    date: '2026-05-01',
    timeStart: '09:00',
    capacity: 5,
    currentBookings: 0,
  }

  const request: BookingRequest = {
    requestId: 'REQ-1',
    citizenId: 'CIT-1',
    serviceId: 'SVC-CIVIL',
    preferredDates: ['2026-05-01'],
    priority: 'NORMAL',
  }

  beforeEach(() => {
    optimizer = new PublicServiceBookingOptimizerAI()
  })

  it('가용 슬롯 있을 때 → CONFIRMED 상태', () => {
    optimizer.registerSlot(slot)
    const result = optimizer.submitRequest(request)
    expect(result.status).toBe('CONFIRMED')
    expect(result.assignedSlotId).toBe('SL-1')
  })

  it('가용 슬롯 없을 때 → WAITLISTED 상태', () => {
    optimizer.registerSlot({ ...slot, capacity: 0 })
    const result = optimizer.submitRequest(request)
    expect(result.status).toBe('WAITLISTED')
    expect(result.waitlistPosition).toBeGreaterThanOrEqual(1)
  })

  it('슬롯 만석 후 추가 예약 → WAITLISTED', () => {
    optimizer.registerSlot({ ...slot, capacity: 1 })
    optimizer.submitRequest(request)
    const result = optimizer.submitRequest({ ...request, requestId: 'REQ-2', citizenId: 'CIT-2' })
    expect(result.status).toBe('WAITLISTED')
  })

  it('EMERGENCY 우선순위 → waitlistPosition=1', () => {
    optimizer.registerSlot({ ...slot, capacity: 0 })
    const result = optimizer.submitRequest({ ...request, requestId: 'REQ-EMG', priority: 'EMERGENCY' })
    expect(result.waitlistPosition).toBe(1)
  })

  it('generateReport: 예약률 계산 정확', () => {
    optimizer.registerSlot({ ...slot, capacity: 10 })
    optimizer.submitRequest(request)
    const report = optimizer.generateReport()
    expect(report.confirmedCount).toBe(1)
    expect(report.utilizationRate).toBeGreaterThan(0)
    expect(report.utilizationRate).toBeLessThanOrEqual(1)
  })

  it('generateReport: 슬롯 없을 때 → utilizationRate=0', () => {
    const report = optimizer.generateReport()
    expect(report.utilizationRate).toBe(0)
    expect(report.totalRequests).toBe(0)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    optimizer.registerSlot(slot)
    optimizer.submitRequest(request)
    const log1 = optimizer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', requestId: 'X', detail: {} })
    const log2 = optimizer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
