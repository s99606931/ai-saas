/**
 * Unit tests for Retrieval Quality Scorer — SVC-AI-ADV-R113
 */

import { describe, it, expect } from 'vitest'
import {
  RetrievalQualityScorer,
  DataGrade,
  type RetrievalResult,
} from '../retrieval-quality-scorer'

function mkResult(
  id: string,
  embedding: number[],
  ageMs: number,
): RetrievalResult {
  return {
    id,
    content: `content-${id}`,
    embedding,
    timestamp: Date.now() - ageMs,
  }
}

describe('SVC-AI-ADV-R113 RetrievalQualityScorer', () => {
  it('[FR-R113.6] C/S 등급 생성자 차단', () => {
    expect(
      () => new RetrievalQualityScorer({ grade: DataGrade.C }),
    ).toThrow(/BLOCKED/)
    expect(
      () => new RetrievalQualityScorer({ grade: DataGrade.S }),
    ).toThrow(/BLOCKED/)
  })

  it('[FR-R113.1] 정확도: 동일 벡터는 1에 수렴', () => {
    const s = new RetrievalQualityScorer()
    const query = [1, 0, 0]
    const acc = s.accuracyScore(query, [
      mkResult('a', [1, 0, 0], 0),
      mkResult('b', [1, 0, 0], 0),
    ])
    expect(acc).toBeGreaterThan(0.99)
  })

  it('[FR-R113.1] 정확도: 직교 벡터는 0', () => {
    const s = new RetrievalQualityScorer()
    const acc = s.accuracyScore(
      [1, 0, 0],
      [mkResult('a', [0, 1, 0], 0)],
    )
    expect(acc).toBe(0)
  })

  it('[FR-R113.2] 다양성: 동일 결과는 낮은 점수', () => {
    const s = new RetrievalQualityScorer()
    const div = s.diversityScore([
      mkResult('a', [1, 0, 0], 0),
      mkResult('b', [1, 0, 0], 0),
    ])
    expect(div).toBeLessThan(0.1)
  })

  it('[FR-R113.2] 다양성: 직교 결과는 1', () => {
    const s = new RetrievalQualityScorer()
    const div = s.diversityScore([
      mkResult('a', [1, 0, 0], 0),
      mkResult('b', [0, 1, 0], 0),
      mkResult('c', [0, 0, 1], 0),
    ])
    expect(div).toBeGreaterThan(0.99)
  })

  it('[FR-R113.3] 신선도: 최근 문서 높은 점수', () => {
    const s = new RetrievalQualityScorer({
      freshnessHalfLifeMs: 60 * 60 * 1000,
    })
    const fresh = s.freshnessScore([mkResult('a', [1], 0)])
    const old = s.freshnessScore([mkResult('b', [1], 7 * 60 * 60 * 1000)])
    expect(fresh).toBeGreaterThan(old)
  })

  it('[FR-R113.4] 통합 점수 + 임계값 게이트 통과', () => {
    const s = new RetrievalQualityScorer({ threshold: 0.5 })
    const report = s.score(
      'query',
      [1, 0, 0],
      [
        mkResult('a', [1, 0, 0], 0),
        mkResult('b', [0, 1, 0], 0),
      ],
    )
    expect(report.passed).toBe(true)
    expect(report.score).toBeGreaterThan(0.5)
    expect(report.breakdown.accuracy).toBeGreaterThan(0)
    expect(report.queryHash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('[FR-R113.5] 임계값 미달 시 passed=false', () => {
    const s = new RetrievalQualityScorer({ threshold: 0.95 })
    const report = s.score(
      'q',
      [1, 0, 0],
      [mkResult('a', [0, 1, 0], 0)],
    )
    expect(report.passed).toBe(false)
  })

  it('[FR-R113.5] 빈 결과는 0점', () => {
    const s = new RetrievalQualityScorer()
    const report = s.score('q', [1, 0, 0], [])
    expect(report.score).toBe(0)
    expect(report.passed).toBe(false)
    expect(report.resultCount).toBe(0)
  })

  it('[FR-R113.7] 감사 로그 기록', () => {
    const s = new RetrievalQualityScorer()
    s.score('q', [1, 0, 0], [mkResult('a', [1, 0, 0], 0)])
    s.score('q2', [1, 0, 0], [])
    const log = s.getAuditLog()
    expect(log.length).toBe(2)
    expect(log[0]?.action).toBe('score')
    expect(log[1]?.action).toBe('emptyInput')
  })

  it('[NFR-R113.1] 가중치 합 != 1 생성자 오류', () => {
    expect(
      () =>
        new RetrievalQualityScorer({
          weights: { accuracy: 0.5, diversity: 0.5, freshness: 0.5 },
        }),
    ).toThrow(/sum to 1/)
  })
})
