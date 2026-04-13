// Plan SC: SVC-AI-ADV-R463-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataQualityIndexV2, type DataQualityProfile } from '../public-data-quality-index-v2'

describe('PublicDataQualityIndexV2', () => {
  let indexer: PublicDataQualityIndexV2

  const perfectProfile: DataQualityProfile = {
    datasetId: 'DS-1',
    name: '민원 데이터셋',
    grade: 'O',
    totalRecords: 10000,
    missingValueRate: 0,
    duplicateRate: 0,
    formatErrorRate: 0,
    lastUpdatedDaysAgo: 10,
    consistencyScore: 1.0,
  }

  beforeEach(() => {
    indexer = new PublicDataQualityIndexV2()
  })

  it('N2SF: C등급 데이터셋 등록 차단', () => {
    expect(() => indexer.registerProfile({ ...perfectProfile, datasetId: 'DS-C', grade: 'C' })).toThrow('BLOCKED')
  })

  it('N2SF: S등급 데이터셋 등록 차단', () => {
    expect(() => indexer.registerProfile({ ...perfectProfile, datasetId: 'DS-S', grade: 'S' })).toThrow('BLOCKED')
  })

  it('미등록 데이터셋 계산 시 오류 발생', () => {
    expect(() => indexer.calculate('UNKNOWN')).toThrow('Unknown dataset')
  })

  it('완벽한 데이터 → A등급, 점수 90 이상', () => {
    indexer.registerProfile(perfectProfile)
    const result = indexer.calculate('DS-1')
    expect(result.qualityGrade).toBe('A')
    expect(result.overallScore).toBeGreaterThanOrEqual(90)
  })

  it('결측값 비율 높음 → issues에 결측값 관련 항목 포함', () => {
    indexer.registerProfile({ ...perfectProfile, datasetId: 'DS-MISS', missingValueRate: 0.3 })
    const result = indexer.calculate('DS-MISS')
    expect(result.issues.some((i) => i.includes('결측값'))).toBe(true)
  })

  it('중복 레코드 탐지 → recommendations에 중복 제거 포함', () => {
    indexer.registerProfile({ ...perfectProfile, datasetId: 'DS-DUP', duplicateRate: 0.1 })
    const result = indexer.calculate('DS-DUP')
    expect(result.recommendations.some((r) => r.includes('중복'))).toBe(true)
  })

  it('적시성: 200일 미갱신 → 점수 저하, issues 포함', () => {
    indexer.registerProfile({ ...perfectProfile, datasetId: 'DS-OLD', lastUpdatedDaysAgo: 200 })
    const result = indexer.calculate('DS-OLD')
    expect(result.dimensionScores.TIMELINESS).toBe(10)
    expect(result.issues.some((i) => i.includes('적시성'))).toBe(true)
  })

  it('dimensionScores에 5개 차원 모두 존재', () => {
    indexer.registerProfile(perfectProfile)
    const result = indexer.calculate('DS-1')
    expect(result.dimensionScores.COMPLETENESS).toBeDefined()
    expect(result.dimensionScores.ACCURACY).toBeDefined()
    expect(result.dimensionScores.CONSISTENCY).toBeDefined()
    expect(result.dimensionScores.TIMELINESS).toBeDefined()
    expect(result.dimensionScores.UNIQUENESS).toBeDefined()
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    indexer.registerProfile(perfectProfile)
    indexer.calculate('DS-1')
    const log1 = indexer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', datasetId: 'X', detail: {} })
    const log2 = indexer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
