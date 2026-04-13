// Plan SC: SVC-AI-ADV-R430-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ErrorBudgetManagerV2, type SLODefinition } from '../error-budget-manager-v2'

describe('ErrorBudgetManagerV2', () => {
  let manager: ErrorBudgetManagerV2

  const slo: SLODefinition = {
    sloId: 'SLO-1',
    serviceId: 'SVC-1',
    type: 'AVAILABILITY',
    target: 0.999,
    windowDays: 30,
  }

  beforeEach(() => {
    manager = new ErrorBudgetManagerV2()
    manager.registerSLO(slo)
  })

  it('미등록 SLO 조회 시 오류 발생', () => {
    expect(() => manager.getReport('UNKNOWN')).toThrow('Unknown SLO')
  })

  it('관측 데이터 없을 때 HEALTHY 반환', () => {
    const report = manager.getReport('SLO-1')
    expect(report.status).toBe('HEALTHY')
    expect(report.consumed).toBe(0)
    expect(report.remaining).toBe(1)
  })

  it('목표 충족 관측 → 예산 소비 없음', () => {
    const now = Date.now()
    manager.recordObservation({ sloId: 'SLO-1', observedAt: now, actualValue: 0.9995 })
    manager.recordObservation({ sloId: 'SLO-1', observedAt: now - 1000, actualValue: 0.9999 })
    const report = manager.getReport('SLO-1')
    expect(report.consumed).toBe(0)
    expect(report.status).toBe('HEALTHY')
  })

  it('목표 미달 관측 → 예산 소비 발생', () => {
    const now = Date.now()
    // target=0.999, actual=0.990 → miss=0.009 > allowedError=0.001 → consumed>0
    manager.recordObservation({ sloId: 'SLO-1', observedAt: now, actualValue: 0.990 })
    const report = manager.getReport('SLO-1')
    expect(report.consumed).toBeGreaterThan(0)
    expect(report.remaining).toBeLessThan(1)
  })

  it('심각한 미달 → EXHAUSTED 상태', () => {
    const now = Date.now()
    // 예산 100% 소비: actual 훨씬 낮음
    for (let i = 0; i < 5; i++) {
      manager.recordObservation({ sloId: 'SLO-1', observedAt: now - i * 1000, actualValue: 0.5 })
    }
    const report = manager.getReport('SLO-1')
    expect(report.status).toBe('EXHAUSTED')
    expect(report.consumed).toBe(1)
  })

  it('serviceId와 type이 보고서에 포함', () => {
    const report = manager.getReport('SLO-1')
    expect(report.serviceId).toBe('SVC-1')
    expect(report.type).toBe('AVAILABILITY')
    expect(report.target).toBe(0.999)
  })

  it('recommendation 문자열 반환', () => {
    const report = manager.getReport('SLO-1')
    expect(typeof report.recommendation).toBe('string')
    expect(report.recommendation.length).toBeGreaterThan(0)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    manager.getReport('SLO-1')
    const log1 = manager.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', sloId: 'X', detail: {} })
    const log2 = manager.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
