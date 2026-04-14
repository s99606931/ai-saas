import { describe, it, expect, beforeEach } from 'vitest'
import { ServerlessWorkflowOptimizerV2 } from '../serverless-workflow-optimizer-v2'

describe('ServerlessWorkflowOptimizerV2', () => {
  let optimizer: ServerlessWorkflowOptimizerV2

  beforeEach(() => { optimizer = new ServerlessWorkflowOptimizerV2() })

  it('should register a workflow with 100 initial score', () => {
    optimizer.registerWorkflow('wf1', 'Order', 5)
    expect(optimizer.getOptimizationScore('wf1')).toBe(100)
  })

  it('should compute optimization score penalizing duration and cold starts', () => {
    optimizer.registerWorkflow('wf1', 'Order', 3)
    optimizer.recordExecution('wf1', 500, 2, 256) // 100 - 5 - 20 = 75
    expect(optimizer.getOptimizationScore('wf1')).toBe(75)
  })

  it('should not go below 0', () => {
    optimizer.registerWorkflow('wf1', 'Heavy', 10)
    optimizer.recordExecution('wf1', 10000, 10, 1024) // would be very negative → 0
    expect(optimizer.getOptimizationScore('wf1')).toBe(0)
  })

  it('should return slow workflows below threshold', () => {
    optimizer.registerWorkflow('wf1', 'Slow', 3)
    optimizer.registerWorkflow('wf2', 'Fast', 3)
    optimizer.recordExecution('wf1', 5000, 5, 256) // 100 - 50 - 50 = 0
    optimizer.recordExecution('wf2', 100, 0, 256)  // 100 - 1 - 0 = 99
    const slow = optimizer.getSlowWorkflows(50)
    expect(slow.map((w: { workflowId: string }) => w.workflowId)).toContain('wf1')
    expect(slow.map((w: { workflowId: string }) => w.workflowId)).not.toContain('wf2')
  })

  it('should block C grade data', () => {
    optimizer.registerWorkflow('wf1', 'X', 1)
    expect(() => optimizer.recordExecution('wf1', 100, 1, 128, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    optimizer.registerWorkflow('wf1', 'X', 1)
    expect(() => optimizer.recordExecution('wf1', 100, 1, 128, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    optimizer.registerWorkflow('wf1', 'WF', 2)
    optimizer.recordExecution('wf1', 200, 1, 256)
    expect(optimizer.getAuditLog().length).toBeGreaterThan(0)
  })
})
