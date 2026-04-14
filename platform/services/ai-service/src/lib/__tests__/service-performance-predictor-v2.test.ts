import { describe, it, expect, beforeEach } from 'vitest'
import { ServicePerformancePredictorV2 } from '../service-performance-predictor-v2'

describe('ServicePerformancePredictorV2', () => {
  let predictor: ServicePerformancePredictorV2

  beforeEach(() => {
    predictor = new ServicePerformancePredictorV2()
  })

  it('should register a service', () => {
    predictor.registerService('svc1', 'Portal', 'web')
    expect(predictor.getPredictedScore('svc1')).toBe(0)
  })

  it('should compute predicted score as average of last 3 records', () => {
    predictor.registerService('svc1', 'Portal', 'web')
    predictor.recordPerformance('svc1', 80, 'Q1')
    predictor.recordPerformance('svc1', 70, 'Q2')
    predictor.recordPerformance('svc1', 90, 'Q3')
    expect(predictor.getPredictedScore('svc1')).toBeCloseTo(80, 1)
  })

  it('should use only last 3 records for prediction', () => {
    predictor.registerService('svc1', 'Portal', 'web')
    predictor.recordPerformance('svc1', 100, 'Q1') // excluded
    predictor.recordPerformance('svc1', 50, 'Q2')
    predictor.recordPerformance('svc1', 50, 'Q3')
    predictor.recordPerformance('svc1', 50, 'Q4')
    expect(predictor.getPredictedScore('svc1')).toBeCloseTo(50, 1)
  })

  it('should identify low performance services (score < 60)', () => {
    predictor.registerService('svc1', 'Low', 'web')
    predictor.registerService('svc2', 'High', 'web')
    predictor.recordPerformance('svc1', 40, 'Q1')
    predictor.recordPerformance('svc2', 80, 'Q1')
    const low = predictor.getLowPerformanceServices()
    expect(low.map((s: { serviceId: string }) => s.serviceId)).toContain('svc1')
    expect(low.map((s: { serviceId: string }) => s.serviceId)).not.toContain('svc2')
  })

  it('should block C grade data', () => {
    predictor.registerService('svc1', 'S', 'web')
    expect(() => predictor.recordPerformance('svc1', 70, 'Q1', 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    predictor.registerService('svc1', 'S', 'web')
    expect(() => predictor.recordPerformance('svc1', 70, 'Q1', 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    predictor.registerService('svc1', 'Portal', 'web')
    predictor.recordPerformance('svc1', 75, 'Q1')
    expect(predictor.getAuditLog().length).toBeGreaterThan(0)
  })
})
