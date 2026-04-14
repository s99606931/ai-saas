import { describe, it, expect, beforeEach } from 'vitest'
import { DeploymentRollbackOptimizerV2 } from '../deployment-rollback-optimizer-v2'

describe('DeploymentRollbackOptimizerV2', () => {
  let optimizer: DeploymentRollbackOptimizerV2

  beforeEach(() => {
    optimizer = new DeploymentRollbackOptimizerV2()
  })

  it('should register a deployment', () => {
    optimizer.registerDeployment('dep1', 'payment-svc', 'v2.1.0', 'prod')
    expect(optimizer.needsRollback('dep1')).toBe(false)
  })

  it('should not need rollback when error rate <= 5', () => {
    optimizer.registerDeployment('dep1', 'auth-svc', 'v1.0.0', 'staging')
    optimizer.updateStatus('dep1', 'running', 3)
    expect(optimizer.needsRollback('dep1')).toBe(false)
  })

  it('should need rollback when error rate > 5', () => {
    optimizer.registerDeployment('dep1', 'order-svc', 'v3.0.0', 'prod')
    optimizer.updateStatus('dep1', 'running', 6)
    expect(optimizer.needsRollback('dep1')).toBe(true)
  })

  it('should return rollback candidates', () => {
    optimizer.registerDeployment('dep1', 'svc-a', 'v1', 'prod')
    optimizer.registerDeployment('dep2', 'svc-b', 'v2', 'prod')
    optimizer.updateStatus('dep1', 'running', 10)
    optimizer.updateStatus('dep2', 'running', 2)
    const candidates = optimizer.getRollbackCandidates()
    expect(candidates.map((d: { deployId: string }) => d.deployId)).toContain('dep1')
    expect(candidates.map((d: { deployId: string }) => d.deployId)).not.toContain('dep2')
  })

  it('should block C grade data', () => {
    optimizer.registerDeployment('dep1', 'svc', 'v1', 'prod')
    expect(() => optimizer.updateStatus('dep1', 'running', 3, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    optimizer.registerDeployment('dep1', 'svc', 'v1', 'prod')
    expect(() => optimizer.updateStatus('dep1', 'running', 3, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    optimizer.registerDeployment('dep1', 'svc', 'v1', 'prod')
    optimizer.updateStatus('dep1', 'running', 2)
    expect(optimizer.getAuditLog().length).toBeGreaterThan(0)
  })
})
