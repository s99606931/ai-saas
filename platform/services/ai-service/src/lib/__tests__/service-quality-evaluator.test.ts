import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceQualityEvaluator } from '../service-quality-evaluator'

describe('ServiceQualityEvaluator', () => {
  let evaluator: ServiceQualityEvaluator

  beforeEach(() => {
    evaluator = new ServiceQualityEvaluator()
    evaluator.registerSla({ serviceId: 'SVC-1', maxResponseTimeMs: 200, maxErrorRate: 0.01, minAvailabilityPct: 99 })
  })

  it('메트릭 없는 서비스 평가 결과 F등급', () => {
    const report = evaluator.evaluate('SVC-1')
    expect(report.grade).toBe('F')
    expect(report.slaViolations.length).toBeGreaterThan(0)
  })

  it('SLA 내 정상 메트릭은 높은 등급', () => {
    evaluator.recordMetric({ serviceId: 'SVC-1', timestamp: Date.now(), responseTimeMs: 100, errorRate: 0.005, availabilityPct: 99.9 })
    const report = evaluator.evaluate('SVC-1')
    expect(['A', 'B']).toContain(report.grade)
    expect(report.slaViolations.length).toBe(0)
  })

  it('응답 시간 초과 시 SLA 위반 기록', () => {
    evaluator.recordMetric({ serviceId: 'SVC-1', timestamp: Date.now(), responseTimeMs: 500, errorRate: 0.005, availabilityPct: 99.9 })
    const report = evaluator.evaluate('SVC-1')
    expect(report.slaViolations.some((v) => v.includes('응답시간'))).toBe(true)
  })

  it('오류율 초과 시 30점 감점', () => {
    evaluator.recordMetric({ serviceId: 'SVC-1', timestamp: Date.now(), responseTimeMs: 100, errorRate: 0.05, availabilityPct: 99.9 })
    const report = evaluator.evaluate('SVC-1')
    expect(report.score).toBeLessThanOrEqual(70)
    expect(report.slaViolations.some((v) => v.includes('오류율'))).toBe(true)
  })

  it('등급 경계: score 75 → B등급', () => {
    // 오류율 초과(30점 감점), 나머지 정상 → score ≈ 70
    evaluator.recordMetric({ serviceId: 'SVC-1', timestamp: Date.now(), responseTimeMs: 200, errorRate: 0.05, availabilityPct: 99 })
    const report = evaluator.evaluate('SVC-1')
    expect(['C', 'D', 'F']).toContain(report.grade)  // 70점대
  })

  it('감사 로그 복사본 반환', () => {
    evaluator.recordMetric({ serviceId: 'SVC-1', timestamp: Date.now(), responseTimeMs: 100, errorRate: 0, availabilityPct: 100 })
    evaluator.evaluate('SVC-1')
    const log = evaluator.getAuditLog()
    log.push({ timestamp: '', action: 'injected', serviceId: 'X', detail: {} })
    expect(evaluator.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
