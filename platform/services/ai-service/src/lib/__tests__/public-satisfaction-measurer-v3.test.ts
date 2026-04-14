import { describe, it, expect, beforeEach } from 'vitest'
import { PublicSatisfactionMeasurerV3 } from '../public-satisfaction-measurer-v3'

describe('PublicSatisfactionMeasurerV3', () => {
  let measurer: PublicSatisfactionMeasurerV3

  beforeEach(() => {
    measurer = new PublicSatisfactionMeasurerV3()
  })

  it('should register a service', () => {
    measurer.registerService('svc1', 'Portal')
    expect(measurer.getAverageSatisfaction('svc1')).toBe(0)
  })

  it('should compute average satisfaction', () => {
    measurer.registerService('svc1', 'Portal')
    measurer.recordSatisfaction('svc1', 'user1', 4)
    measurer.recordSatisfaction('svc1', 'user2', 2)
    expect(measurer.getAverageSatisfaction('svc1')).toBe(3)
  })

  it('should mask userId with SHA-256 16-char hex', () => {
    measurer.registerService('svc1', 'Portal')
    measurer.recordSatisfaction('svc1', 'user-abc', 4)
    const log = measurer.getAuditLog()
    const entry = log.find((e: { action: string }) => e.action === 'RECORD_SATISFACTION')
    expect(entry?.details?.maskedUserId).not.toBe('user-abc')
    expect(entry?.details?.maskedUserId).toHaveLength(16)
  })

  it('should identify low satisfaction services (avg < 3.0)', () => {
    measurer.registerService('svc1', 'Low')
    measurer.registerService('svc2', 'High')
    measurer.recordSatisfaction('svc1', 'u1', 2)
    measurer.recordSatisfaction('svc2', 'u2', 5)
    const low = measurer.getLowSatisfactionServices()
    expect(low.map((s: { serviceId: string }) => s.serviceId)).toContain('svc1')
    expect(low.map((s: { serviceId: string }) => s.serviceId)).not.toContain('svc2')
  })

  it('should block C grade data', () => {
    measurer.registerService('svc1', 'S')
    expect(() => measurer.recordSatisfaction('svc1', 'u1', 3, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    measurer.registerService('svc1', 'S')
    expect(() => measurer.recordSatisfaction('svc1', 'u1', 3, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    measurer.registerService('svc1', 'Portal')
    measurer.recordSatisfaction('svc1', 'u1', 4)
    expect(measurer.getAuditLog().length).toBeGreaterThan(0)
  })
})
