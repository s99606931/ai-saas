import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceContinuityAssurerAi } from '../service-continuity-assurer-ai'

describe('ServiceContinuityAssurerAi', () => {
  let assurer: ServiceContinuityAssurerAi
  beforeEach(() => { assurer = new ServiceContinuityAssurerAi() })

  it('서비스 등록 후 조회 가능', () => {
    const svc = assurer.registerService('svc-1', '민원서비스', 2, 1)
    expect(svc.serviceId).toBe('svc-1')
    expect(svc.rto).toBe(2)
  })

  it('장애 없으면 점수 100', () => {
    assurer.registerService('svc-1', '민원서비스', 2, 1)
    expect(assurer.getContinuityScore('svc-1')).toBe(100)
  })

  it('장애 기록 후 점수 감소', () => {
    assurer.registerService('svc-1', '민원서비스', 2, 1)
    assurer.recordOutage('svc-1', 2, 1)
    // 100 - (2/2)*50 - 1*10 = 100 - 50 - 10 = 40
    expect(assurer.getContinuityScore('svc-1')).toBe(40)
  })

  it('점수 최소 0', () => {
    assurer.registerService('svc-1', '민원서비스', 1, 1)
    assurer.recordOutage('svc-1', 10, 20)
    expect(assurer.getContinuityScore('svc-1')).toBe(0)
  })

  it('getAtRiskServices: score < 60', () => {
    assurer.registerService('svc-1', 'A', 2, 1)
    assurer.registerService('svc-2', 'B', 100, 1)
    assurer.recordOutage('svc-1', 2, 1)
    const atRisk = assurer.getAtRiskServices()
    expect(atRisk.map(s => s.serviceId)).toContain('svc-1')
    expect(atRisk.map(s => s.serviceId)).not.toContain('svc-2')
  })

  it('C등급 데이터 전송 차단', () => {
    assurer.registerService('svc-1', '민원서비스', 2, 1)
    expect(() => assurer.recordOutage('svc-1', 1, 1, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    assurer.registerService('svc-1', '민원서비스', 2, 1)
    expect(() => assurer.recordOutage('svc-1', 1, 1, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    assurer.registerService('svc-1', '민원서비스', 2, 1)
    assurer.recordOutage('svc-1', 1, 0)
    expect(assurer.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
