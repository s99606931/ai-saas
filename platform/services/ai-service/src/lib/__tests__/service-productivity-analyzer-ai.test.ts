import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceProductivityAnalyzerAi } from '../service-productivity-analyzer-ai'

describe('ServiceProductivityAnalyzerAi', () => {
  let analyzer: ServiceProductivityAnalyzerAi

  beforeEach(() => {
    analyzer = new ServiceProductivityAnalyzerAi()
  })

  it('should register a service', () => {
    analyzer.registerService('svc1', 'API Service', 5)
    expect(analyzer.getProductivityScore('svc1')).toBe(0)
  })

  it('should compute productivity score: (requestsHandled + defectsFixed*2) / teamSize', () => {
    analyzer.registerService('svc1', 'API Service', 5)
    analyzer.recordMetrics('svc1', 20, 5)
    // (20 + 5*2) / 5 = 30/5 = 6
    expect(analyzer.getProductivityScore('svc1')).toBe(6)
  })

  it('should accumulate metrics across multiple records', () => {
    analyzer.registerService('svc1', 'API', 4)
    analyzer.recordMetrics('svc1', 10, 2)
    analyzer.recordMetrics('svc1', 10, 3)
    // (20 + 10) / 4 = 30/4 = 7.5
    expect(analyzer.getProductivityScore('svc1')).toBe(7.5)
  })

  it('should return low productivity services (score < 10)', () => {
    analyzer.registerService('svc1', 'Slow Service', 10)
    analyzer.recordMetrics('svc1', 20, 5)
    // (20 + 10) / 10 = 3 < 10
    const low = analyzer.getLowProductivityServices()
    expect(low.map((s: { serviceId: string }) => s.serviceId)).toContain('svc1')
  })

  it('should not flag high productivity service', () => {
    analyzer.registerService('svc1', 'Fast', 2)
    analyzer.recordMetrics('svc1', 50, 10)
    // (50 + 20) / 2 = 35 >= 10
    expect(analyzer.getLowProductivityServices()).toHaveLength(0)
  })

  it('should block C grade data', () => {
    analyzer.registerService('svc1', 'Test', 3)
    expect(() => analyzer.recordMetrics('svc1', 10, 2, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    analyzer.registerService('svc1', 'Test', 3)
    expect(() => analyzer.recordMetrics('svc1', 10, 2, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    analyzer.registerService('svc1', 'Svc', 5)
    analyzer.recordMetrics('svc1', 10, 2)
    expect(analyzer.getAuditLog().length).toBeGreaterThan(0)
  })
})
