import { describe, it, expect, beforeEach } from 'vitest'
import { ServerlessCostOptimizer } from '../serverless-cost-optimizer'

describe('ServerlessCostOptimizer', () => {
  let optimizer: ServerlessCostOptimizer

  beforeEach(() => {
    optimizer = new ServerlessCostOptimizer()
  })

  it('실행 기록 없는 함수 비용 계산 — 0원', () => {
    const cost = optimizer.calculateCost('FN-X')
    expect(cost.estimatedCost).toBe(0)
    expect(cost.totalInvocations).toBe(0)
  })

  it('비용 계산: 시간 × 메모리 비례', () => {
    optimizer.recordExecution({ functionId: 'FN-1', timestamp: 0, durationMs: 1000, memoryMb: 128, coldStart: false })
    const cost = optimizer.calculateCost('FN-1')
    expect(cost.totalInvocations).toBe(1)
    expect(cost.estimatedCost).toBeGreaterThan(0)
  })

  it('메모리 과할당(>512MB) → MEMORY_OVERALLOC 제안', () => {
    for (let i = 0; i < 5; i++) {
      optimizer.recordExecution({ functionId: 'FN-2', timestamp: i * 1000, durationMs: 500, memoryMb: 1024, coldStart: false })
    }
    const suggestions = optimizer.suggestOptimizations('FN-2')
    expect(suggestions.some((s) => s.type === 'MEMORY_OVERALLOC')).toBe(true)
  })

  it('콜드스타트 비율 30% 초과 → COLDSTART_HIGH 제안', () => {
    for (let i = 0; i < 10; i++) {
      optimizer.recordExecution({ functionId: 'FN-3', timestamp: i * 1000, durationMs: 200, memoryMb: 256, coldStart: i < 4 })
    }
    const suggestions = optimizer.suggestOptimizations('FN-3')
    expect(suggestions.some((s) => s.type === 'COLDSTART_HIGH')).toBe(true)
  })

  it('평균 실행 시간 3000ms 초과 → DURATION_HIGH 제안', () => {
    optimizer.recordExecution({ functionId: 'FN-4', timestamp: 0, durationMs: 5000, memoryMb: 256, coldStart: false })
    const suggestions = optimizer.suggestOptimizations('FN-4')
    expect(suggestions.some((s) => s.type === 'DURATION_HIGH')).toBe(true)
  })

  it('실행 없는 함수 절감 리포트 null', () => {
    expect(optimizer.generateSavingsReport('FN-NONE')).toBeNull()
  })

  it('감사 로그 복사본 반환', () => {
    optimizer.recordExecution({ functionId: 'FN-5', timestamp: 0, durationMs: 100, memoryMb: 128, coldStart: false })
    optimizer.calculateCost('FN-5')
    const log = optimizer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', functionId: 'X', detail: {} })
    expect(optimizer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
