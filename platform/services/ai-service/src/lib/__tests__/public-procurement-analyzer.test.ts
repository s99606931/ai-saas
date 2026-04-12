import { describe, it, expect, beforeEach } from 'vitest'
import { PublicProcurementAnalyzer } from '../public-procurement-analyzer'

describe('PublicProcurementAnalyzer', () => {
  let analyzer: PublicProcurementAnalyzer

  beforeEach(() => {
    analyzer = new PublicProcurementAnalyzer()
    analyzer.registerTender({ tenderId: 'T1', item: 'PC', budget: 1000000, deadline: '2026-06-30', method: 'LOWEST_PRICE' })
    analyzer.registerTender({ tenderId: 'T2', item: 'PC', budget: 2000000, deadline: '2026-07-31', method: 'QUALIFIED' })
  })

  it('정상 낙찰 — isAnomaly false', () => {
    const result = analyzer.recordAward({ tenderId: 'T1', awardedPrice: 850000, vendor: '업체A', awardedAt: '2026-06-01' })
    expect(result.isAnomaly).toBe(false)
    expect(result.awardRate).toBeCloseTo(0.85)
  })

  it('덤핑 낙찰 탐지 (awardRate < 0.5)', () => {
    const result = analyzer.recordAward({ tenderId: 'T1', awardedPrice: 400000, vendor: '덤핑업체', awardedAt: '2026-06-01' })
    expect(result.isAnomaly).toBe(true)
    expect(result.reason).toContain('덤핑')
  })

  it('예산 초과 낙찰 탐지 (awardRate > 1.0)', () => {
    const result = analyzer.recordAward({ tenderId: 'T1', awardedPrice: 1100000, vendor: '초과업체', awardedAt: '2026-06-01' })
    expect(result.isAnomaly).toBe(true)
    expect(result.reason).toContain('예산 초과')
  })

  it('알 수 없는 입찰 ID 낙찰 시 오류', () => {
    expect(() => analyzer.recordAward({ tenderId: 'UNKNOWN', awardedPrice: 900000, vendor: '업체', awardedAt: '2026-06-01' })).toThrow('Unknown tender')
  })

  it('품목별 평균 낙찰률 통계', () => {
    analyzer.recordAward({ tenderId: 'T1', awardedPrice: 900000, vendor: 'A', awardedAt: '2026-06-01' })
    analyzer.recordAward({ tenderId: 'T2', awardedPrice: 1800000, vendor: 'B', awardedAt: '2026-07-01' })
    const stats = analyzer.getStats()
    const pcStat = stats.find((s) => s.item === 'PC')
    expect(pcStat).toBeDefined()
    expect(pcStat!.avgAwardRate).toBeCloseTo(0.9)
    expect(pcStat!.count).toBe(2)
  })

  it('감사 로그 복사본 반환', () => {
    analyzer.recordAward({ tenderId: 'T1', awardedPrice: 800000, vendor: 'C', awardedAt: '2026-06-01' })
    const log = analyzer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', detail: {} })
    expect(analyzer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
