import { describe, it, expect, beforeEach } from 'vitest'
import { DepartmentPerformanceDashboard } from '../department-performance-dashboard'

describe('DepartmentPerformanceDashboard', () => {
  let dashboard: DepartmentPerformanceDashboard

  beforeEach(() => {
    dashboard = new DepartmentPerformanceDashboard()
    dashboard.registerKpi({ kpiId: 'K1', department: '기획부', name: '예산집행률', targetValue: 100, unit: '%' })
    dashboard.registerKpi({ kpiId: 'K2', department: '기획부', name: '민원처리율', targetValue: 95, unit: '%' })
  })

  it('알 수 없는 KPI 실적 기록 시 오류', () => {
    expect(() => dashboard.recordActual({ kpiId: 'UNKNOWN', period: '2026-Q1', actualValue: 90 })).toThrow('Unknown KPI')
  })

  it('실적 없는 부서 D등급', () => {
    const perf = dashboard.getDeptPerformance('기획부')
    expect(perf.grade).toBe('D')
    expect(perf.avgAchievementRate).toBe(0)
  })

  it('목표 120% 초과 달성 시 S등급', () => {
    dashboard.recordActual({ kpiId: 'K1', period: '2026-Q1', actualValue: 125 })
    dashboard.recordActual({ kpiId: 'K2', period: '2026-Q1', actualValue: 115 })
    const perf = dashboard.getDeptPerformance('기획부')
    expect(perf.grade).toBe('S')
  })

  it('목표 90% 이상 달성 시 A등급', () => {
    dashboard.recordActual({ kpiId: 'K1', period: '2026-Q1', actualValue: 92 })
    dashboard.recordActual({ kpiId: 'K2', period: '2026-Q1', actualValue: 88 })
    const perf = dashboard.getDeptPerformance('기획부')
    expect(['A', 'B']).toContain(perf.grade)
  })

  it('KPI 개수 반환', () => {
    const perf = dashboard.getDeptPerformance('기획부')
    expect(perf.kpiCount).toBe(2)
  })

  it('감사 로그 복사본 반환', () => {
    dashboard.recordActual({ kpiId: 'K1', period: '2026-Q1', actualValue: 95 })
    dashboard.getDeptPerformance('기획부')
    const log = dashboard.getAuditLog()
    log.push({ timestamp: '', action: 'injected', detail: {} })
    expect(dashboard.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
