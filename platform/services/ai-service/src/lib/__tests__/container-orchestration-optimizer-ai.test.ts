import { describe, it, expect, beforeEach } from 'vitest'
import { ContainerOrchestrationOptimizerAi } from '../container-orchestration-optimizer-ai'

describe('ContainerOrchestrationOptimizerAi', () => {
  let optimizer: ContainerOrchestrationOptimizerAi

  beforeEach(() => {
    optimizer = new ContainerOrchestrationOptimizerAi()
  })

  it('should register a container', () => {
    optimizer.registerContainer('c1', 'api-pod', 1000, 512)
    expect(optimizer.getOptimizationRecommendation('c1')).toBe('no-data')
  })

  it('should recommend over-provisioned when avg usage < 50%', () => {
    optimizer.registerContainer('c1', 'idle-pod', 1000, 1024)
    optimizer.recordUsage('c1', 30, 40) // avg 35 < 50
    expect(optimizer.getOptimizationRecommendation('c1')).toBe('over-provisioned')
  })

  it('should recommend under-provisioned when avg usage > 90%', () => {
    optimizer.registerContainer('c1', 'busy-pod', 1000, 1024)
    optimizer.recordUsage('c1', 95, 92) // avg 93.5 > 90
    expect(optimizer.getOptimizationRecommendation('c1')).toBe('under-provisioned')
  })

  it('should recommend optimal for 50-90% usage', () => {
    optimizer.registerContainer('c1', 'normal-pod', 1000, 1024)
    optimizer.recordUsage('c1', 60, 70) // avg 65 — optimal
    expect(optimizer.getOptimizationRecommendation('c1')).toBe('optimal')
  })

  it('should return over-provisioned containers list', () => {
    optimizer.registerContainer('c1', 'idle', 1000, 512)
    optimizer.registerContainer('c2', 'busy', 1000, 512)
    optimizer.recordUsage('c1', 20, 25)
    optimizer.recordUsage('c2', 80, 85)
    const overProv = optimizer.getOverProvisionedContainers()
    expect(overProv.map((c: { containerId: string }) => c.containerId)).toContain('c1')
    expect(overProv.map((c: { containerId: string }) => c.containerId)).not.toContain('c2')
  })

  it('should block C grade data', () => {
    optimizer.registerContainer('c1', 'pod', 1000, 512)
    expect(() => optimizer.recordUsage('c1', 50, 50, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    optimizer.registerContainer('c1', 'pod', 1000, 512)
    expect(() => optimizer.recordUsage('c1', 50, 50, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    optimizer.registerContainer('c1', 'pod', 500, 256)
    optimizer.recordUsage('c1', 60, 60)
    expect(optimizer.getAuditLog().length).toBeGreaterThan(0)
  })
})
