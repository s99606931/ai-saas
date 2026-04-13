import { describe, it, expect, beforeEach } from 'vitest'
import { DataLakeManagerAi, type DataLakeZone, type DataLakeMetric } from '../data-lake-manager-ai'

describe('DataLakeManagerAi', () => {
  let manager: DataLakeManagerAi

  const zone: DataLakeZone = {
    zoneId: 'ZONE001',
    name: '공공 데이터 레이크',
    dataGrade: 'O',
    currentSizeGb: 500,
    maxSizeGb: 1000,
    retentionDays: 365,
  }

  const makeMetric = (queries: number, lastAccess: number, growth: number): DataLakeMetric => ({
    zoneId: 'ZONE001',
    timestamp: Date.now(),
    queryCountPerHour: queries,
    lastAccessedDaysAgo: lastAccess,
    growthRateGbPerDay: growth,
  })

  beforeEach(() => {
    manager = new DataLakeManagerAi()
    manager.registerZone(zone)
  })

  it('C등급 존 등록 차단', () => {
    expect(() => manager.registerZone({ ...zone, zoneId: 'ZONE_C', dataGrade: 'C' })).toThrow('BLOCKED')
  })

  it('S등급 존 등록 차단', () => {
    expect(() => manager.registerZone({ ...zone, zoneId: 'ZONE_S', dataGrade: 'S' })).toThrow('BLOCKED')
  })

  it('존 등록 감사 로그', () => {
    const log = manager.getAuditLog()
    expect(log.some((e) => e.action === 'zone.register')).toBe(true)
  })

  it('메트릭 없으면 HOT 유지', () => {
    const plan = manager.plan('ZONE001')
    expect(plan.recommendedTier).toBe('HOT')
  })

  it('90일 이상 미접근 → ARCHIVE', () => {
    manager.recordMetric(makeMetric(0, 100, 1))
    const plan = manager.plan('ZONE001')
    expect(plan.recommendedTier).toBe('ARCHIVE')
    expect(plan.estimatedCostSavingPercent).toBe(70)
  })

  it('30일 이상 미접근 → COLD', () => {
    manager.recordMetric(makeMetric(0, 45, 1))
    const plan = manager.plan('ZONE001')
    expect(plan.recommendedTier).toBe('COLD')
  })

  it('용량 90% 초과 → CRITICAL 알림', () => {
    const bigZone: DataLakeZone = { ...zone, zoneId: 'ZONE002', currentSizeGb: 950, maxSizeGb: 1000 }
    manager.registerZone(bigZone)
    const plan = manager.plan('ZONE002')
    expect(plan.capacityAlertLevel).toBe('CRITICAL')
    expect(plan.recommendations.some((r) => r.includes('용량'))).toBe(true)
  })

  it('미등록 존 에러', () => {
    expect(() => manager.plan('UNKNOWN')).toThrow()
  })

  it('계획 후 감사 로그', () => {
    manager.plan('ZONE001')
    const log = manager.getAuditLog()
    expect(log.some((e) => e.action === 'zone.plan')).toBe(true)
  })
})
