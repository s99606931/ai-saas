// Plan SC: SVC-AI-ADV-R586-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceAvailabilityPredictorV2, type AvailabilityRecord } from '../service-availability-predictor-v2'

describe('ServiceAvailabilityPredictorV2', () => {
  let predictor: ServiceAvailabilityPredictorV2

  const makeRecord = (date: string, pct: number): AvailabilityRecord => ({
    serviceId: 'SVC-1', date, availabilityPct: pct, totalIncidents: 0, mttrMinutes: 5,
  })

  beforeEach(() => {
    predictor = new ServiceAvailabilityPredictorV2()
  })

  it('이력 없는 서비스 예측 시 오류 발생', () => {
    expect(() => predictor.predict('UNKNOWN')).toThrow('No history for service')
  })

  it('안정적 고가용성 → LOW 위험, STABLE 트렌드', () => {
    for (let i = 1; i <= 7; i++) {
      predictor.ingestHistory(makeRecord(`2026-01-0${i}`, 99.9))
    }
    const pred = predictor.predict('SVC-1')
    expect(pred.riskLevel).toBe('LOW')
    expect(pred.trend).toBe('STABLE')
  })

  it('가용성 하락 트렌드 → DECLINING + WARNING 알림', () => {
    predictor.ingestHistory(makeRecord('2026-01-01', 99.9))
    predictor.ingestHistory(makeRecord('2026-01-02', 99.5))
    predictor.ingestHistory(makeRecord('2026-01-03', 99.0))
    predictor.ingestHistory(makeRecord('2026-01-04', 98.5))
    const pred = predictor.predict('SVC-1')
    expect(pred.trend).toBe('DECLINING')
    expect(pred.alerts.length).toBeGreaterThan(0)
  })

  it('예측 가용성 95% 미만 → CRITICAL 위험', () => {
    for (let i = 1; i <= 7; i++) {
      predictor.ingestHistory(makeRecord(`2026-01-0${i}`, 92))
    }
    const pred = predictor.predict('SVC-1')
    expect(pred.riskLevel).toBe('CRITICAL')
    expect(pred.alerts.some((a) => a.severity === 'CRITICAL')).toBe(true)
  })

  it('acknowledge: 알림 처리 후 getAlerts에서 제외', () => {
    for (let i = 1; i <= 7; i++) predictor.ingestHistory(makeRecord(`2026-01-0${i}`, 92))
    predictor.predict('SVC-1')
    const alerts = predictor.getAlerts('SVC-1')
    expect(alerts.length).toBeGreaterThan(0)
    predictor.acknowledge(alerts[0]!.alertId)
    const after = predictor.getAlerts('SVC-1')
    expect(after.length).toBe(alerts.length - 1)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    predictor.ingestHistory(makeRecord('2026-01-01', 99.9))
    predictor.predict('SVC-1')
    const log1 = predictor.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = predictor.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
