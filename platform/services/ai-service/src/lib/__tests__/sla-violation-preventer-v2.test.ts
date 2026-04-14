// Plan SC: SVC-AI-ADV-R489-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { SLAViolationPreventerV2, type SLAContract, type ServiceMetric } from '../sla-violation-preventer-v2'

describe('SLAViolationPreventerV2', () => {
  let preventer: SLAViolationPreventerV2

  const contract: SLAContract = {
    contractId: 'CON-1',
    serviceId: 'SVC-1',
    tier: 'GOLD',
    targetAvailabilityPct: 99.9,
    maxResponseTimeMs: 500,
    maxIncidentsPerMonth: 2,
    penaltyPerViolationKrw: 1_000_000,
  }

  const goodMetric: ServiceMetric = {
    metricId: 'M-1',
    serviceId: 'SVC-1',
    timestamp: Date.now(),
    availabilityPct: 99.95,
    responseTimeMs: 300,
    errorRatePct: 0.1,
  }

  beforeEach(() => {
    preventer = new SLAViolationPreventerV2()
  })

  it('미등록 계약 분석 시 오류 발생', () => {
    expect(() => preventer.analyze('UNKNOWN')).toThrow('Unknown contract')
  })

  it('메트릭 없을 때 → OK, estimatedPenaltyKrw=0', () => {
    preventer.registerContract(contract)
    const report = preventer.analyze('CON-1')
    expect(report.violationRisk).toBe('OK')
    expect(report.estimatedPenaltyKrw).toBe(0)
  })

  it('정상 메트릭 → violationRisk=OK', () => {
    preventer.registerContract(contract)
    preventer.ingestMetric(goodMetric)
    const report = preventer.analyze('CON-1')
    expect(report.violationRisk).toBe('OK')
  })

  it('가용성 SLA 미달 → CRITICAL 알림, CRITICAL violationRisk', () => {
    preventer.registerContract(contract)
    preventer.ingestMetric({ ...goodMetric, metricId: 'M-LOW', availabilityPct: 99.5 })
    const report = preventer.analyze('CON-1')
    expect(report.alerts.some((a) => a.metric === 'AVAILABILITY' && a.level === 'CRITICAL')).toBe(true)
    expect(report.violationRisk).toBe('CRITICAL')
  })

  it('응답 시간 초과 → CRITICAL 알림', () => {
    preventer.registerContract(contract)
    preventer.ingestMetric({ ...goodMetric, metricId: 'M-SLOW', responseTimeMs: 600 })
    const report = preventer.analyze('CON-1')
    expect(report.alerts.some((a) => a.metric === 'RESPONSE_TIME' && a.level === 'CRITICAL')).toBe(true)
  })

  it('오류율 5% 초과 → CRITICAL 알림', () => {
    preventer.registerContract(contract)
    preventer.ingestMetric({ ...goodMetric, metricId: 'M-ERR', errorRatePct: 6 })
    const report = preventer.analyze('CON-1')
    expect(report.alerts.some((a) => a.metric === 'ERROR_RATE' && a.level === 'CRITICAL')).toBe(true)
  })

  it('CRITICAL 알림 시 estimatedPenaltyKrw > 0', () => {
    preventer.registerContract(contract)
    preventer.ingestMetric({ ...goodMetric, metricId: 'M-PEN', availabilityPct: 99.0 })
    const report = preventer.analyze('CON-1')
    if (report.violationRisk === 'CRITICAL') {
      expect(report.estimatedPenaltyKrw).toBeGreaterThan(0)
    }
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    preventer.registerContract(contract)
    preventer.ingestMetric(goodMetric)
    preventer.analyze('CON-1')
    const log1 = preventer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', contractId: 'X', detail: {} })
    const log2 = preventer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
