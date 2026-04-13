// Design Ref: §R393 — AI기반 서비스 비용 최적화 엔진 v2
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceCostOptimizerV2, type ServiceCostRecord } from '../service-cost-optimizer-v2'

describe('ServiceCostOptimizerV2', () => {
  let optimizer: ServiceCostOptimizerV2

  const makeRecord = (overrides: Partial<ServiceCostRecord> = {}): ServiceCostRecord => ({
    serviceId: 'svc-a',
    month: '2026-04',
    computeCost: 1000,
    storageCost: 200,
    networkCost: 100,
    licenseCost: 100,
    cpuUtilizationPercent: 60,
    memoryUtilizationPercent: 60,
    ...overrides,
  })

  beforeEach(() => {
    optimizer = new ServiceCostOptimizerV2()
  })

  it('RIGHTSIZE: CPU/메모리 30% 미만 → RIGHTSIZE HIGH 추천', () => {
    optimizer.recordCost(makeRecord({ cpuUtilizationPercent: 20, memoryUtilizationPercent: 25 }))
    const report = optimizer.optimize('2026-04')
    const rec = report.recommendations.find((r) => r.action === 'RIGHTSIZE')
    expect(rec).toBeDefined()
    expect(rec?.priority).toBe('HIGH')
  })

  it('RESERVED_INSTANCE: 3개월 이상 안정적 이력 + 중간 활용률 → 예약 인스턴스', () => {
    for (let i = 1; i <= 3; i++) {
      optimizer.recordCost(makeRecord({ month: `2026-0${i}`, cpuUtilizationPercent: 40, memoryUtilizationPercent: 45 }))
    }
    const report = optimizer.optimize('2026-03')
    const rec = report.recommendations.find((r) => r.action === 'RESERVED_INSTANCE')
    expect(rec).toBeDefined()
    expect(rec?.estimatedSavingPercent).toBe(30)
  })

  it('STORAGE_TIER_DOWN: 스토리지 비용 > 컴퓨트 50% → 스토리지 등급 하향', () => {
    optimizer.recordCost(makeRecord({ computeCost: 1000, storageCost: 600 }))
    const report = optimizer.optimize('2026-04')
    expect(report.recommendations.some((r) => r.action === 'STORAGE_TIER_DOWN')).toBe(true)
  })

  it('LICENSE_CONSOLIDATION: 라이선스 비용 > 전체 30% → 통합 추천', () => {
    optimizer.recordCost(makeRecord({ computeCost: 500, storageCost: 100, networkCost: 100, licenseCost: 400 }))
    const report = optimizer.optimize('2026-04')
    expect(report.recommendations.some((r) => r.action === 'LICENSE_CONSOLIDATION')).toBe(true)
  })

  it('NO_ACTION: 최적화 이미 완료된 서비스', () => {
    optimizer.recordCost(makeRecord({ cpuUtilizationPercent: 70, memoryUtilizationPercent: 70, storageCost: 100, licenseCost: 50 }))
    const report = optimizer.optimize('2026-04')
    expect(report.recommendations.some((r) => r.action === 'NO_ACTION')).toBe(true)
  })

  it('topOpportunities: 절감액 상위 3개 반환', () => {
    for (let i = 0; i < 4; i++) {
      optimizer.recordCost(makeRecord({ serviceId: `svc-${i}`, cpuUtilizationPercent: 20, memoryUtilizationPercent: 20 }))
    }
    const report = optimizer.optimize('2026-04')
    expect(report.topOpportunities.length).toBeLessThanOrEqual(3)
  })

  it('감사 로그에 optimize 기록', () => {
    optimizer.recordCost(makeRecord())
    optimizer.optimize('2026-04')
    const logs = optimizer.getAuditLog()
    expect(logs.some((l) => l.action === 'cost.optimize')).toBe(true)
  })
})
