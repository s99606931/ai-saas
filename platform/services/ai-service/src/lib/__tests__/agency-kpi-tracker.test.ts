import { describe, it, expect, beforeEach } from 'vitest'
import { AgencyKpiTracker } from '../agency-kpi-tracker'

describe('AgencyKpiTracker', () => {
  let k: AgencyKpiTracker

  beforeEach(() => {
    k = new AgencyKpiTracker()
    k.defineKpi(
      { kpiId: 'satisfaction', name: '민원 만족도', target: 90, direction: 'UP' },
      'admin'
    )
    k.defineKpi(
      { kpiId: 'response-time', name: '응답시간', target: 24, direction: 'DOWN' },
      'admin'
    )
  })

  it('빈 kpiId 차단', () => {
    expect(() =>
      k.defineKpi({ kpiId: '', name: 'n', target: 1, direction: 'UP' }, 'a')
    ).toThrow('kpiId')
  })

  it('target 양수 검증', () => {
    expect(() =>
      k.defineKpi({ kpiId: 'x', name: 'n', target: 0, direction: 'UP' }, 'a')
    ).toThrow('target')
  })

  it('중복 kpiId 차단', () => {
    expect(() =>
      k.defineKpi(
        { kpiId: 'satisfaction', name: 'n', target: 1, direction: 'UP' },
        'a'
      )
    ).toThrow('중복')
  })

  it('C등급 측정 차단', () => {
    expect(() => k.recordMeasurement('satisfaction', '2026-01', 85, 'C', 'a')).toThrow(
      'BLOCKED'
    )
  })

  it('없는 kpiId 측정 차단', () => {
    expect(() => k.recordMeasurement('none', '2026-01', 85, 'O', 'a')).toThrow(
      'kpiId 없음'
    )
  })

  it('음수 value 차단', () => {
    expect(() =>
      k.recordMeasurement('satisfaction', '2026-01', -1, 'O', 'a')
    ).toThrow('value')
  })

  it('중복 period 차단', () => {
    k.recordMeasurement('satisfaction', '2026-01', 85, 'O', 'a')
    expect(() =>
      k.recordMeasurement('satisfaction', '2026-01', 90, 'O', 'a')
    ).toThrow('중복 period')
  })

  it('UP 방향 ON_TRACK', () => {
    k.recordMeasurement('satisfaction', '2026-01', 95, 'O', 'a')
    const e = k.evaluate('satisfaction')
    expect(e.status).toBe('ON_TRACK')
    expect(e.achievementPct).toBeGreaterThanOrEqual(100)
  })

  it('UP 방향 AT_RISK — 80~99%', () => {
    k.recordMeasurement('satisfaction', '2026-01', 75, 'O', 'a') // 90*0.8=72 이상
    const e = k.evaluate('satisfaction')
    expect(e.status).toBe('AT_RISK')
  })

  it('UP 방향 OFF_TRACK — <80%', () => {
    k.recordMeasurement('satisfaction', '2026-01', 60, 'O', 'a')
    const e = k.evaluate('satisfaction')
    expect(e.status).toBe('OFF_TRACK')
  })

  it('DOWN 방향 ON_TRACK — target 이하', () => {
    k.recordMeasurement('response-time', '2026-01', 20, 'O', 'a')
    const e = k.evaluate('response-time')
    expect(e.status).toBe('ON_TRACK')
  })

  it('DOWN 방향 AT_RISK — target*1.2 이하', () => {
    k.recordMeasurement('response-time', '2026-01', 28, 'O', 'a')
    const e = k.evaluate('response-time')
    expect(e.status).toBe('AT_RISK')
  })

  it('DOWN 방향 OFF_TRACK', () => {
    k.recordMeasurement('response-time', '2026-01', 50, 'O', 'a')
    const e = k.evaluate('response-time')
    expect(e.status).toBe('OFF_TRACK')
  })

  it('트렌드 RISING', () => {
    k.recordMeasurement('satisfaction', '2026-01', 70, 'O', 'a')
    k.recordMeasurement('satisfaction', '2026-02', 80, 'O', 'a')
    k.recordMeasurement('satisfaction', '2026-03', 90, 'O', 'a')
    const e = k.evaluate('satisfaction')
    expect(e.trend).toBe('RISING')
  })

  it('트렌드 FALLING', () => {
    k.recordMeasurement('satisfaction', '2026-01', 90, 'O', 'a')
    k.recordMeasurement('satisfaction', '2026-02', 80, 'O', 'a')
    k.recordMeasurement('satisfaction', '2026-03', 70, 'O', 'a')
    const e = k.evaluate('satisfaction')
    expect(e.trend).toBe('FALLING')
  })

  it('트렌드 FLAT', () => {
    k.recordMeasurement('satisfaction', '2026-01', 85, 'O', 'a')
    k.recordMeasurement('satisfaction', '2026-02', 85, 'O', 'a')
    k.recordMeasurement('satisfaction', '2026-03', 85, 'O', 'a')
    const e = k.evaluate('satisfaction')
    expect(e.trend).toBe('FLAT')
  })

  it('측정값 없음 evaluate 오류', () => {
    expect(() => k.evaluate('satisfaction')).toThrow('측정값 없음')
  })

  it('listKpis', () => {
    expect(k.listKpis().sort()).toEqual(['response-time', 'satisfaction'])
  })

  it('measurementCount 반영', () => {
    k.recordMeasurement('satisfaction', '2026-01', 90, 'O', 'a')
    k.recordMeasurement('satisfaction', '2026-02', 92, 'O', 'a')
    const e = k.evaluate('satisfaction')
    expect(e.measurementCount).toBe(2)
  })

  it('감사 로그 — 마스킹', () => {
    const log = k.getAuditLog()
    const def = log.find((e) => e.action === 'kpi.define')
    expect(def?.callerMasked).toContain('***')
  })
})
