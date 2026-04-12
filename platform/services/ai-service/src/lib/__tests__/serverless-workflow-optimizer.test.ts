import { describe, it, expect, beforeEach } from 'vitest'
import { ServerlessWorkflowOptimizer, type FunctionConfig, type FunctionInvocation } from '../serverless-workflow-optimizer'

describe('ServerlessWorkflowOptimizer', () => {
  let optimizer: ServerlessWorkflowOptimizer

  const config: FunctionConfig = {
    functionId: 'FN001',
    name: '민원 처리 핸들러',
    runtime: 'nodejs',
    memoryMb: 512,
    timeoutMs: 30000,
    triggerType: 'HTTP',
  }

  const makeInvocation = (durationMs: number, memoryUsedMb: number, coldStart: boolean, success = true): FunctionInvocation => ({
    functionId: 'FN001',
    durationMs,
    memoryUsedMb,
    coldStart,
    success,
    timestamp: Date.now(),
  })

  beforeEach(() => {
    optimizer = new ServerlessWorkflowOptimizer()
    optimizer.registerFunction(config)
  })

  it('함수 등록 감사 로그', () => {
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'function.register')).toBe(true)
  })

  it('호출 없으면 NO_CHANGE', () => {
    const result = optimizer.optimize('FN001')
    expect(result.action).toBe('NO_CHANGE')
    expect(result.currentMemoryMb).toBe(512)
  })

  it('메모리 사용률 40% 미만 → DECREASE_MEMORY', () => {
    for (let i = 0; i < 5; i++) optimizer.recordInvocation(makeInvocation(200, 100, false))
    // 100/512 ≈ 19.5% < 40%
    const result = optimizer.optimize('FN001')
    expect(result.action).toBe('DECREASE_MEMORY')
    expect(result.recommendedMemoryMb).toBeLessThan(512)
    expect(result.estimatedCostSaving).toBeGreaterThan(0)
  })

  it('메모리 사용률 85% 초과 → INCREASE_MEMORY', () => {
    for (let i = 0; i < 5; i++) optimizer.recordInvocation(makeInvocation(800, 450, false))
    // 450/512 ≈ 87.9% > 85%
    const result = optimizer.optimize('FN001')
    expect(result.action).toBe('INCREASE_MEMORY')
    expect(result.recommendedMemoryMb).toBeGreaterThan(512)
  })

  it('HTTP + 콜드스타트 30% 초과 → ENABLE_PROVISIONED', () => {
    for (let i = 0; i < 3; i++) optimizer.recordInvocation(makeInvocation(300, 256, true))
    for (let i = 0; i < 7; i++) optimizer.recordInvocation(makeInvocation(300, 256, false))
    // coldStartRate = 3/10 = 30% — boundary: should be > 0.3 so not triggered
    // use 4 cold starts out of 10 = 40%
    optimizer = new ServerlessWorkflowOptimizer()
    optimizer.registerFunction(config)
    for (let i = 0; i < 4; i++) optimizer.recordInvocation(makeInvocation(300, 256, true))
    for (let i = 0; i < 6; i++) optimizer.recordInvocation(makeInvocation(300, 256, false))
    const result = optimizer.optimize('FN001')
    expect(result.action).toBe('ENABLE_PROVISIONED')
  })

  it('미등록 함수 에러', () => {
    expect(() => optimizer.optimize('UNKNOWN')).toThrow()
  })

  it('미등록 함수 호출 기록 에러', () => {
    expect(() => optimizer.recordInvocation({ ...makeInvocation(200, 100, false), functionId: 'UNKNOWN' })).toThrow()
  })

  it('최적화 후 감사 로그', () => {
    optimizer.recordInvocation(makeInvocation(200, 256, false))
    optimizer.optimize('FN001')
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'function.optimize')).toBe(true)
  })
})
