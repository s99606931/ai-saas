import { describe, it, expect, beforeEach } from 'vitest'
import { HealthcareResourceAllocatorAi } from '../healthcare-resource-allocator-ai.js'

describe('HealthcareResourceAllocatorAi (FR-R506.1)', () => {
  let svc: HealthcareResourceAllocatorAi

  beforeEach(() => {
    svc = new HealthcareResourceAllocatorAi()
    svc.registerHospital(
      { hospitalId: 'H1', region: '서울', beds: 50, ventilators: 10, staff: 100 },
      'O'
    )
    svc.registerHospital(
      { hospitalId: 'H2', region: '부산', beds: 30, ventilators: 5, staff: 50 },
      'O'
    )
  })

  it('동일 지역 우선 배분', () => {
    const plan = svc.allocate(
      { requestId: 'R1', region: '서울', beds: 10, ventilators: 2, staff: 20, priority: 1 },
      'O'
    )
    expect(plan.status).toBe('OK')
    expect(plan.hospitalId).toBe('H1')
  })

  it('동일 지역 부족 시 다른 지역', () => {
    const plan = svc.allocate(
      { requestId: 'R2', region: '대구', beds: 25, ventilators: 4, staff: 40, priority: 2 },
      'O'
    )
    expect(plan.status).toBe('OK')
    expect(['H1', 'H2']).toContain(plan.hospitalId)
  })

  it('자원 부족 시 PARTIAL', () => {
    const plan = svc.allocate(
      { requestId: 'R3', region: '서울', beds: 1000, ventilators: 100, staff: 1000, priority: 1 },
      'O'
    )
    expect(plan.status).toBe('PARTIAL')
    expect(plan.allocatedBeds).toBeGreaterThan(0)
  })

  it('가용 병원 없음 → UNMET', () => {
    const empty = new HealthcareResourceAllocatorAi()
    const plan = empty.allocate(
      { requestId: 'R4', region: '서울', beds: 10, ventilators: 1, staff: 5, priority: 1 },
      'O'
    )
    expect(plan.status).toBe('UNMET')
    expect(plan.hospitalId).toBeNull()
  })

  it('우선순위 범위 검증', () => {
    expect(() =>
      svc.allocate(
        { requestId: 'R5', region: '서울', beds: 1, ventilators: 1, staff: 1, priority: 10 },
        'O'
      )
    ).toThrow(/priority/)
  })

  it('배분 후 자원 차감 확인 + 감사 로그', () => {
    svc.allocate(
      { requestId: 'R6', region: '서울', beds: 5, ventilators: 1, staff: 10, priority: 1 },
      'O'
    )
    const h1 = svc.getHospital('H1')
    expect(h1?.beds).toBe(45)
    expect(svc.getAuditLog().length).toBeGreaterThanOrEqual(3)
  })
})
