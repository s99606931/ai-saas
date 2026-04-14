import { describe, it, expect, beforeEach } from 'vitest'
import { ApiLifecycleOptimizerV2 } from '../api-lifecycle-optimizer-v2'

describe('ApiLifecycleOptimizerV2', () => {
  let optimizer: ApiLifecycleOptimizerV2
  beforeEach(() => { optimizer = new ApiLifecycleOptimizerV2() })

  it('API 등록 후 조회 가능', () => {
    const api = optimizer.registerApi('api-1', 'v1.0', 'active', '2025-01-01')
    expect(api.apiId).toBe('api-1')
    expect(api.status).toBe('active')
  })

  it('사용 없으면 건강 점수 100', () => {
    optimizer.registerApi('api-1', 'v1.0', 'active', '2025-01-01')
    expect(optimizer.getHealthScore('api-1')).toBe(100)
  })

  it('건강 점수: (1 - errorRate)*100', () => {
    optimizer.registerApi('api-1', 'v1.0', 'active', '2025-01-01')
    optimizer.recordUsage('api-1', 100, 20)
    // (1 - 20/100) * 100 = 80
    expect(optimizer.getHealthScore('api-1')).toBe(80)
  })

  it('누적 사용 통계', () => {
    optimizer.registerApi('api-1', 'v1.0', 'active', '2025-01-01')
    optimizer.recordUsage('api-1', 50, 5)
    optimizer.recordUsage('api-1', 50, 5)
    // total: 100 calls, 10 errors → (1-10/100)*100 = 90
    expect(optimizer.getHealthScore('api-1')).toBe(90)
  })

  it('getDeprecatedApis: deprecated 상태만', () => {
    optimizer.registerApi('api-1', 'v1.0', 'active', '2025-01-01')
    optimizer.registerApi('api-2', 'v0.9', 'deprecated', '2024-01-01')
    const deprecated = optimizer.getDeprecatedApis()
    expect(deprecated.map(a => a.apiId)).toContain('api-2')
    expect(deprecated.map(a => a.apiId)).not.toContain('api-1')
  })

  it('C등급 데이터 전송 차단', () => {
    optimizer.registerApi('api-1', 'v1.0', 'active', '2025-01-01')
    expect(() => optimizer.recordUsage('api-1', 100, 5, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    optimizer.registerApi('api-1', 'v1.0', 'active', '2025-01-01')
    expect(() => optimizer.recordUsage('api-1', 100, 5, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    optimizer.registerApi('api-1', 'v1.0', 'active', '2025-01-01')
    optimizer.recordUsage('api-1', 100, 5)
    expect(optimizer.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
