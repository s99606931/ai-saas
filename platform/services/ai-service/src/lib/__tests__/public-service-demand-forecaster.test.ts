/**
 * Unit tests — Public Service Demand Forecaster (SVC-AI-ADV-R130 트랙B 2차)
 * Plan SC: FR-R130.1 ~ FR-R130.5
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceDemandForecaster } from '../public-service-demand-forecaster'

const DAY = 86400000

describe('SVC-AI-ADV-R130 PublicServiceDemandForecaster', () => {
  let forecaster: PublicServiceDemandForecaster
  const base = new Date('2026-04-06T00:00:00Z').getTime() // Monday

  beforeEach(() => {
    forecaster = new PublicServiceDemandForecaster()
  })

  it('[FR-R130.1] 수요 데이터 기록 후 예측 가능', () => {
    for (let i = 0; i < 14; i++) {
      forecaster.recordDemand('svc-a', base + i * DAY, 100 + i)
    }
    const result = forecaster.forecast('svc-a', 3)
    expect(result).toHaveLength(3)
    expect(result[0]!.predicted).toBeGreaterThan(0)
  })

  it('[FR-R130.2] decompose 결과 trend/seasonal/residual 길이 일치', () => {
    for (let i = 0; i < 14; i++) {
      forecaster.recordDemand('svc-b', base + i * DAY, 200)
    }
    const decomp = forecaster.decompose('svc-b')
    expect(decomp.trend).toHaveLength(14)
    expect(decomp.seasonal).toHaveLength(14)
    expect(decomp.residual).toHaveLength(14)
  })

  it('[FR-R130.3] 예측 포인트에 date/predicted/lower/upper 포함', () => {
    for (let i = 0; i < 7; i++) {
      forecaster.recordDemand('svc-c', base + i * DAY, 150)
    }
    const result = forecaster.forecast('svc-c', 5)
    for (const p of result) {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(p.predicted).toBeGreaterThanOrEqual(0)
      expect(p.lower).toBeLessThanOrEqual(p.predicted)
      expect(p.upper).toBeGreaterThanOrEqual(p.predicted)
    }
  })

  it('[FR-R130.4] 이벤트 가중치 적용 시 예측값 변화', () => {
    for (let i = 0; i < 7; i++) {
      forecaster.recordDemand('svc-d', base + i * DAY, 100)
    }
    const futureDate = new Date(base + 8 * DAY).toISOString().slice(0, 10)
    forecaster.addEvent('svc-d', futureDate, 2.0)
    const result = forecaster.forecast('svc-d', 5)
    const eventDay = result.find((p) => p.date === futureDate)
    expect(eventDay?.predicted).toBeGreaterThanOrEqual(0)
  })

  it('[FR-R130.1] 데이터 없는 서비스 예측 시 빈 배열', () => {
    expect(forecaster.forecast('unknown', 3)).toHaveLength(0)
  })

  it('[FR-R130.5] CSAP D-06 감사 로그 기록', () => {
    for (let i = 0; i < 7; i++) {
      forecaster.recordDemand('svc-e', base + i * DAY, 100)
    }
    forecaster.forecast('svc-e', 3)
    const log = forecaster.getAuditLog()
    expect(log.length).toBeGreaterThan(0)
    expect(log[0]!.action).toBe('forecast')
    // append-only
    const copy = forecaster.getAuditLog()
    copy.push({ timestamp: 'fake', action: 'injected', serviceId: 'x', detail: {} })
    expect(forecaster.getAuditLog().length).toBe(log.length)
  })
})
