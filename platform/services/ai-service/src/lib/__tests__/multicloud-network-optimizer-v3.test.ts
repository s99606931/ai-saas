import { describe, it, expect, beforeEach } from 'vitest'
import { MulticloudNetworkOptimizerV3 } from '../multicloud-network-optimizer-v3'

describe('MulticloudNetworkOptimizerV3', () => {
  let optimizer: MulticloudNetworkOptimizerV3

  beforeEach(() => { optimizer = new MulticloudNetworkOptimizerV3() })

  it('should register a link with 0 efficiency', () => {
    optimizer.registerLink('l1', 'aws-kr', 'gcp-us', 'aws')
    expect(optimizer.getEfficiencyScore('l1')).toBe(0)
  })

  it('should compute efficiency score', () => {
    optimizer.registerLink('l1', 'aws', 'gcp', 'aws')
    optimizer.recordMetrics('l1', 1000, 10, 0.05) // 100 - 1 - 0.05 = 98.95
    expect(optimizer.getEfficiencyScore('l1')).toBeCloseTo(98.95, 1)
  })

  it('should identify low efficiency links', () => {
    optimizer.registerLink('l1', 'a', 'b', 'aws')
    optimizer.registerLink('l2', 'c', 'd', 'gcp')
    optimizer.recordMetrics('l1', 10, 500, 100) // very low
    optimizer.recordMetrics('l2', 1000, 5, 0.01) // high
    const low = optimizer.getLowEfficiencyLinks(5)
    expect(low.map((l: { linkId: string }) => l.linkId)).toContain('l1')
    expect(low.map((l: { linkId: string }) => l.linkId)).not.toContain('l2')
  })

  it('should block C grade data', () => {
    optimizer.registerLink('l1', 'a', 'b', 'aws')
    expect(() => optimizer.recordMetrics('l1', 100, 10, 0.1, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    optimizer.registerLink('l1', 'a', 'b', 'aws')
    expect(() => optimizer.recordMetrics('l1', 100, 10, 0.1, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    optimizer.registerLink('l1', 'a', 'b', 'aws')
    optimizer.recordMetrics('l1', 500, 20, 0.5)
    expect(optimizer.getAuditLog().length).toBeGreaterThan(0)
  })
})
