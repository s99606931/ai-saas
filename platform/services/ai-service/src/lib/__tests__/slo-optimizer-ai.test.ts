import { describe, it, expect, beforeEach } from 'vitest'
import { SloOptimizerAI } from '../slo-optimizer-ai'

describe('SloOptimizerAI', () => {
  let optimizer: SloOptimizerAI

  beforeEach(() => {
    optimizer = new SloOptimizerAI()
    optimizer.registerSlo({
      sloId: 'SLO-1',
      serviceName: '민원 서비스',
      targetAvailability: 0.999,
      targetLatencyMs: 200,
      targetErrorRate: 0.001,
    })
  })

  it('알 수 없는 SLO 최적화 시 오류', () => {
    expect(() => optimizer.optimize('UNKNOWN')).toThrow('Unknown SLO')
  })

  it('메트릭 없으면 정상 상태 반환', () => {
    const result = optimizer.optimize('SLO-1')
    expect(result.atRisk).toBe(false)
    expect(result.burnRate).toBe(0)
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  it('레이턴시 초과 시 권고 포함', () => {
    optimizer.recordMetrics({ sloId: 'SLO-1', windowStart: '2026-04-12T00:00:00Z', windowEnd: '2026-04-12T01:00:00Z', measuredAvailability: 0.999, measuredLatencyMs: 500, measuredErrorRate: 0.001 })
    const result = optimizer.optimize('SLO-1')
    expect(result.recommendations.some((r) => r.includes('레이턴시'))).toBe(true)
  })

  it('에러율 초과 시 권고 포함', () => {
    optimizer.recordMetrics({ sloId: 'SLO-1', windowStart: '2026-04-12T00:00:00Z', windowEnd: '2026-04-12T01:00:00Z', measuredAvailability: 0.999, measuredLatencyMs: 150, measuredErrorRate: 0.05 })
    const result = optimizer.optimize('SLO-1')
    expect(result.recommendations.some((r) => r.includes('에러율'))).toBe(true)
  })

  it('가용성 저하 시 atRisk=true', () => {
    optimizer.recordMetrics({ sloId: 'SLO-1', windowStart: '2026-04-12T00:00:00Z', windowEnd: '2026-04-12T01:00:00Z', measuredAvailability: 0.95, measuredLatencyMs: 150, measuredErrorRate: 0.001 })
    const result = optimizer.optimize('SLO-1')
    expect(result.atRisk).toBe(true)
  })

  it('감사 로그 복사본 반환', () => {
    optimizer.optimize('SLO-1')
    const log = optimizer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', sloId: 'X', detail: {} })
    expect(optimizer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
