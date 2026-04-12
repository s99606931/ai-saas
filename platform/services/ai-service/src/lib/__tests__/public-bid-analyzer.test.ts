/**
 * 공공 입찰 분석 AI 단위 테스트 — SVC-AI-ADV-R159
 * Plan SC: FR-R159.1 ~ FR-R159.5
 */

import { describe, it, expect } from 'vitest'
import { PublicBidAnalyzer, DataGrade } from '../public-bid-analyzer'

const sampleNotice = {
  id: 'bid-001',
  title: '행정 정보시스템 구축',
  budget: 500_000_000,
  requirements: ['SI', '클라우드', '보안'],
  deadline: '2026-06-30',
  category: 'IT',
}

describe('PublicBidAnalyzer — R159', () => {
  it('FR-R159.1: 공고 등록 및 audit log', () => {
    const analyzer = new PublicBidAnalyzer(DataGrade.O)
    analyzer.registerNotice(sampleNotice)
    const log = analyzer.getAuditLog()
    expect(log[0]?.action).toBe('noticeRegistered')
    expect(log[0]?.details.id).toBe('bid-001')
  })

  it('FR-R159.2: 적격성 점수 계산 — 요건 전부 충족', () => {
    const analyzer = new PublicBidAnalyzer(DataGrade.O)
    analyzer.registerNotice(sampleNotice)
    const result = analyzer.analyze('bid-001', {
      capabilities: ['SI', '클라우드', '보안'],
      pastBudgetRange: [100_000_000, 1_000_000_000],
      certifications: [],
    })
    expect(result.eligibilityScore).toBe(1)
    expect(result.eligibilityGaps).toHaveLength(0)
  })

  it('FR-R159.2: 적격성 점수 — 일부 충족', () => {
    const analyzer = new PublicBidAnalyzer(DataGrade.O)
    analyzer.registerNotice(sampleNotice)
    const result = analyzer.analyze('bid-001', {
      capabilities: ['SI'],
      pastBudgetRange: [100_000_000, 1_000_000_000],
      certifications: [],
    })
    expect(result.eligibilityScore).toBeCloseTo(1 / 3)
    expect(result.eligibilityGaps).toContain('클라우드')
    expect(result.eligibilityGaps).toContain('보안')
  })

  it('FR-R159.3: 예산 적합성 판단', () => {
    const analyzer = new PublicBidAnalyzer(DataGrade.O)
    analyzer.registerNotice(sampleNotice)
    const fit = analyzer.analyze('bid-001', {
      capabilities: ['SI', '클라우드', '보안'],
      pastBudgetRange: [100_000_000, 800_000_000],
      certifications: [],
    })
    expect(fit.budgetFit).toBe(true)

    const noFit = analyzer.analyze('bid-001', {
      capabilities: ['SI', '클라우드', '보안'],
      pastBudgetRange: [600_000_000, 1_000_000_000],
      certifications: [],
    })
    expect(noFit.budgetFit).toBe(false)
  })

  it('FR-R159.4: 전략 추천 — aggressive (score >= 0.8)', () => {
    const analyzer = new PublicBidAnalyzer(DataGrade.O)
    analyzer.registerNotice(sampleNotice)
    const result = analyzer.analyze('bid-001', {
      capabilities: ['SI', '클라우드', '보안'],
      pastBudgetRange: [100_000_000, 1_000_000_000],
      certifications: [],
    })
    expect(result.recommendedStrategy).toBe('aggressive')
  })

  it('FR-R159.4: 전략 추천 — conservative (0.5 <= score < 0.8)', () => {
    const analyzer = new PublicBidAnalyzer(DataGrade.O)
    analyzer.registerNotice({ ...sampleNotice, requirements: ['SI', '클라우드', '보안', 'MSA', '데이터'] })
    const result = analyzer.analyze('bid-001', {
      capabilities: ['SI', '클라우드', '보안'],
      pastBudgetRange: [100_000_000, 1_000_000_000],
      certifications: [],
    })
    expect(result.eligibilityScore).toBeCloseTo(3 / 5)
    expect(result.recommendedStrategy).toBe('conservative')
  })

  it('FR-R159.5: audit log append-only', () => {
    const analyzer = new PublicBidAnalyzer(DataGrade.O)
    analyzer.registerNotice(sampleNotice)
    const log1 = analyzer.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    const log2 = analyzer.getAuditLog()
    expect(log2).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new PublicBidAnalyzer(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new PublicBidAnalyzer(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 id 등록 throw', () => {
    const analyzer = new PublicBidAnalyzer(DataGrade.O)
    expect(() => analyzer.registerNotice({ ...sampleNotice, id: '' })).toThrow('must not be empty')
  })

  it('미등록 공고 분석 throw', () => {
    const analyzer = new PublicBidAnalyzer(DataGrade.O)
    expect(() => analyzer.analyze('unknown', { capabilities: [], pastBudgetRange: [0, 1], certifications: [] }))
      .toThrow('unknown notice')
  })
})
