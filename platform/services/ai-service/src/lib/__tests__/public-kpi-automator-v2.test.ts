import { describe, it, expect, beforeEach } from 'vitest'
import { PublicKpiAutomatorV2 } from '../public-kpi-automator-v2'

describe('PublicKpiAutomatorV2', () => {
  let automator: PublicKpiAutomatorV2

  beforeEach(() => {
    automator = new PublicKpiAutomatorV2()
  })

  it('KPI 등록 후 조회 가능', () => {
    const kpi = automator.registerKpi('kpi-1', '민원처리율', 100, '%')
    expect(kpi.kpiId).toBe('kpi-1')
    expect(kpi.targetValue).toBe(100)
  })

  it('실적 기록 후 달성률 계산', () => {
    automator.registerKpi('kpi-1', '민원처리율', 100, '%')
    automator.recordActual('kpi-1', 80)
    expect(automator.getAchievementRate('kpi-1')).toBe(80)
  })

  it('100% 달성 시 미달성 목록 제외', () => {
    automator.registerKpi('kpi-1', '민원처리율', 100, '%')
    automator.recordActual('kpi-1', 100)
    expect(automator.getUnderperformingKpis().map((k) => k.kpiId)).not.toContain('kpi-1')
  })

  it('미달성 KPI 목록 반환', () => {
    automator.registerKpi('kpi-1', '민원처리율', 100, '%')
    automator.registerKpi('kpi-2', '응답시간', 200, 'ms')
    automator.recordActual('kpi-1', 80)
    automator.recordActual('kpi-2', 200)
    const under = automator.getUnderperformingKpis()
    expect(under.map((k) => k.kpiId)).toContain('kpi-1')
    expect(under.map((k) => k.kpiId)).not.toContain('kpi-2')
  })

  it('실적 없으면 달성률 0', () => {
    automator.registerKpi('kpi-1', '민원처리율', 100, '%')
    expect(automator.getAchievementRate('kpi-1')).toBe(0)
  })

  it('C등급 데이터 전송 차단', () => {
    automator.registerKpi('kpi-1', '민원처리율', 100, '%')
    expect(() => automator.recordActual('kpi-1', 80, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    automator.registerKpi('kpi-1', '민원처리율', 100, '%')
    expect(() => automator.recordActual('kpi-1', 80, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    automator.registerKpi('kpi-1', '민원처리율', 100, '%')
    automator.recordActual('kpi-1', 80)
    const log = automator.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
