import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceLevelOptimizerAIV3 } from '../service-level-optimizer-ai-v3'

describe('ServiceLevelOptimizerAIV3', () => {
  let optimizer: ServiceLevelOptimizerAIV3

  beforeEach(() => {
    optimizer = new ServiceLevelOptimizerAIV3()
  })

  it('N2SF C등급 서비스 등록 차단', () => {
    expect(() => optimizer.registerService('s1', 0.99, 'C')).toThrow('BLOCKED')
  })

  it('잘못된 sloTarget 거부', () => {
    expect(() => optimizer.registerService('s2', 1.5, 'O')).toThrow('sloTarget')
  })

  it('SLO 위반율 ≥ 30% → SCALE_UP 권고', () => {
    optimizer.registerService('s3', 0.99, 'O')
    optimizer.recordMetric('s3', 50, 0.05)
    optimizer.recordMetric('s3', 60, 0.04)
    optimizer.recordMetric('s3', 70, 0.03)
    optimizer.recordMetric('s3', 80, 0.02)
    const report = optimizer.evaluate('s3')
    expect(report.violationRate).toBeGreaterThanOrEqual(0.3)
    expect(report.recommendation).toBe('SCALE_UP')
  })

  it('낮은 위반율 + 낮은 latency → SCALE_DOWN 권고', () => {
    optimizer.registerService('s4', 0.5, 'O')
    optimizer.recordMetric('s4', 20, 0)
    optimizer.recordMetric('s4', 30, 0)
    const report = optimizer.evaluate('s4')
    expect(report.recommendation).toBe('SCALE_DOWN')
  })

  it('메트릭 없음 → STABLE', () => {
    optimizer.registerService('s5', 0.99, 'O')
    const report = optimizer.evaluate('s5')
    expect(report.recommendation).toBe('STABLE')
  })

  it('감사 로그 복사본 반환', () => {
    optimizer.registerService('s6', 0.9, 'O')
    const log = optimizer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', serviceId: 'X', detail: {} })
    expect(optimizer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
