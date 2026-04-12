import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceKpiAutomator, type KpiDefinition } from '../public-service-kpi-automator'

describe('PublicServiceKpiAutomator', () => {
  let ai: PublicServiceKpiAutomator

  const kpi: KpiDefinition = {
    kpiId: 'KPI001',
    name: '민원 처리율',
    unit: '%',
    target: 95,
    direction: 'UP',
    weight: 1,
  }

  beforeEach(() => {
    ai = new PublicServiceKpiAutomator()
    ai.registerKpi(kpi)
  })

  it('KPI 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'kpi.register')).toBe(true)
  })

  it('측정값 없으면 score 0, CRITICAL', () => {
    const report = ai.analyze()
    const status = report.statuses.find((s) => s.kpiId === 'KPI001')!
    expect(status.status).toBe('CRITICAL')
    expect(status.currentValue).toBe(0)
  })

  it('목표 달성 → ON_TRACK', () => {
    ai.recordMeasurement({ kpiId: 'KPI001', value: 96, measuredAt: new Date().toISOString() })
    const report = ai.analyze()
    const status = report.statuses.find((s) => s.kpiId === 'KPI001')!
    expect(status.status).toBe('ON_TRACK')
    expect(status.achievementRate).toBe(100)
  })

  it('80~99% → AT_RISK', () => {
    ai.recordMeasurement({ kpiId: 'KPI001', value: 80, measuredAt: new Date().toISOString() })
    const report = ai.analyze()
    const status = report.statuses.find((s) => s.kpiId === 'KPI001')!
    expect(status.status).toBe('AT_RISK')
  })

  it('DOWN 방향 KPI — 목표 이하 ON_TRACK', () => {
    ai.registerKpi({ kpiId: 'KPI002', name: '오류율', unit: '%', target: 1, direction: 'DOWN', weight: 1 })
    ai.recordMeasurement({ kpiId: 'KPI002', value: 0.5, measuredAt: new Date().toISOString() })
    const report = ai.analyze()
    const status = report.statuses.find((s) => s.kpiId === 'KPI002')!
    expect(status.status).toBe('ON_TRACK')
  })

  it('RISING 트렌드 감지', () => {
    const times = ['2026-04-01', '2026-04-02', '2026-04-03']
    times.forEach((t, i) => ai.recordMeasurement({ kpiId: 'KPI001', value: 70 + i * 10, measuredAt: t }))
    const report = ai.analyze()
    const status = report.statuses.find((s) => s.kpiId === 'KPI001')!
    expect(status.trend).toBe('RISING')
  })

  it('CRITICAL KPI → recommendations 생성', () => {
    const report = ai.analyze()
    expect(report.recommendations.some((r) => r.includes('KPI001') || r.includes('민원 처리율'))).toBe(true)
  })

  it('미등록 KPI 측정 에러', () => {
    expect(() => ai.recordMeasurement({ kpiId: 'UNKNOWN', value: 50, measuredAt: new Date().toISOString() })).toThrow()
  })

  it('분석 후 감사 로그', () => {
    ai.analyze()
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'kpi.analyze')).toBe(true)
  })
})
