import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataHubOptimizerAi } from '../public-data-hub-optimizer-ai'

describe('PublicDataHubOptimizerAi', () => {
  let optimizer: PublicDataHubOptimizerAi
  beforeEach(() => { optimizer = new PublicDataHubOptimizerAi() })

  it('소스 등록 후 조회 가능', () => {
    const src = optimizer.registerSource('src-1', '민원DB', 'database', 100)
    expect(src.sourceId).toBe('src-1')
    expect(src.dataVolumeGB).toBe(100)
  })

  it('접근 패턴 없으면 점수 0', () => {
    optimizer.registerSource('src-1', '민원DB', 'database', 100)
    expect(optimizer.getOptimizationScore('src-1')).toBe(0)
  })

  it('최적화 점수: accessCount*10 / (avgLatencyMs+1)', () => {
    optimizer.registerSource('src-1', '민원DB', 'database', 100)
    optimizer.recordAccessPattern('src-1', 10, 9)
    // 10*10 / (9+1) = 100/10 = 10
    expect(optimizer.getOptimizationScore('src-1')).toBe(10)
  })

  it('getOptimizationPriority: 점수 내림차순', () => {
    optimizer.registerSource('src-1', 'A', 'db', 10)
    optimizer.registerSource('src-2', 'B', 'db', 10)
    optimizer.recordAccessPattern('src-1', 5, 0)
    optimizer.recordAccessPattern('src-2', 100, 0)
    const sorted = optimizer.getOptimizationPriority()
    expect(sorted[0].sourceId).toBe('src-2')
  })

  it('C등급 데이터 전송 차단', () => {
    optimizer.registerSource('src-1', '민원DB', 'database', 100)
    expect(() => optimizer.recordAccessPattern('src-1', 10, 5, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    optimizer.registerSource('src-1', '민원DB', 'database', 100)
    expect(() => optimizer.recordAccessPattern('src-1', 10, 5, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    optimizer.registerSource('src-1', '민원DB', 'database', 100)
    optimizer.recordAccessPattern('src-1', 10, 5)
    expect(optimizer.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
