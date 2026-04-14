import { describe, it, expect, beforeEach } from 'vitest'
import { ServerlessCostOptimizerV2 } from '../serverless-cost-optimizer-v2'

describe('ServerlessCostOptimizerV2', () => {
  let optimizer: ServerlessCostOptimizerV2

  beforeEach(() => { optimizer = new ServerlessCostOptimizerV2() })

  it('should register a function with 0 cost', () => {
    optimizer.registerFunction('fn1', 'processor', 512, 'ap-northeast-2')
    expect(optimizer.getTotalCost('fn1')).toBe(0)
    expect(optimizer.getAverageDuration('fn1')).toBe(0)
  })

  it('should accumulate total cost', () => {
    optimizer.registerFunction('fn1', 'proc', 512, 'ap-northeast-2')
    optimizer.recordInvocation('fn1', 100, 100, 0.001)
    optimizer.recordInvocation('fn1', 200, 200, 0.002)
    expect(optimizer.getTotalCost('fn1')).toBeCloseTo(0.003, 5)
  })

  it('should compute average duration', () => {
    optimizer.registerFunction('fn1', 'proc', 512, 'ap-northeast-2')
    optimizer.recordInvocation('fn1', 100, 100, 0.001)
    optimizer.recordInvocation('fn1', 300, 300, 0.003)
    expect(optimizer.getAverageDuration('fn1')).toBe(200)
  })

  it('should identify high cost functions', () => {
    optimizer.registerFunction('fn1', 'expensive', 1024, 'ap-northeast-2')
    optimizer.registerFunction('fn2', 'cheap', 128, 'ap-northeast-2')
    optimizer.recordInvocation('fn1', 1000, 1000, 10)
    optimizer.recordInvocation('fn2', 50, 50, 0.001)
    const high = optimizer.getHighCostFunctions(5)
    expect(high.map((f: { functionId: string }) => f.functionId)).toContain('fn1')
    expect(high.map((f: { functionId: string }) => f.functionId)).not.toContain('fn2')
  })

  it('should block C grade data', () => {
    optimizer.registerFunction('fn1', 'x', 128, 'ap-northeast-2')
    expect(() => optimizer.recordInvocation('fn1', 100, 100, 0.001, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    optimizer.registerFunction('fn1', 'x', 128, 'ap-northeast-2')
    expect(() => optimizer.recordInvocation('fn1', 100, 100, 0.001, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    optimizer.registerFunction('fn1', 'proc', 256, 'us-east-1')
    optimizer.recordInvocation('fn1', 200, 200, 0.002)
    expect(optimizer.getAuditLog().length).toBeGreaterThan(0)
  })
})
