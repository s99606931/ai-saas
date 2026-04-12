import { describe, it, expect, beforeEach } from 'vitest'
import { SupplyChainRiskScorer } from '../supply-chain-risk-scorer'

describe('SupplyChainRiskScorer', () => {
  let scorer: SupplyChainRiskScorer

  beforeEach(() => {
    scorer = new SupplyChainRiskScorer()
    scorer.registerVendor(
      {
        vendorId: 'v-safe',
        name: 'SafeVendor',
        country: 'KR',
        category: 'CLOUD',
        certifications: ['ISO27001', 'SOC2'],
        cveCount: 0,
        incidentCount: 0,
        financialStability: 85,
      },
      'buyer-1',
      'O'
    )
  })

  it('C등급 차단', () => {
    expect(() =>
      scorer.registerVendor(
        {
          vendorId: 'v',
          name: 'X',
          country: 'KR',
          category: 'C',
          certifications: [],
          cveCount: 0,
          incidentCount: 0,
          financialStability: 80,
        },
        'c',
        'C'
      )
    ).toThrow('BLOCKED')
  })

  it('음수 값 차단', () => {
    expect(() =>
      scorer.registerVendor(
        {
          vendorId: 'v',
          name: 'X',
          country: 'KR',
          category: 'C',
          certifications: [],
          cveCount: -1,
          incidentCount: 0,
          financialStability: 80,
        },
        'c',
        'O'
      )
    ).toThrow('cveCount')
  })

  it('financialStability 범위 초과 차단', () => {
    expect(() =>
      scorer.registerVendor(
        {
          vendorId: 'v',
          name: 'X',
          country: 'KR',
          category: 'C',
          certifications: [],
          cveCount: 0,
          incidentCount: 0,
          financialStability: 150,
        },
        'c',
        'O'
      )
    ).toThrow('financialStability')
  })

  it('중복 vendor 차단', () => {
    expect(() =>
      scorer.registerVendor(
        {
          vendorId: 'v-safe',
          name: 'X',
          country: 'KR',
          category: 'C',
          certifications: [],
          cveCount: 0,
          incidentCount: 0,
          financialStability: 80,
        },
        'c',
        'O'
      )
    ).toThrow('중복')
  })

  it('안전 업체 — LOW 수준', () => {
    const s = scorer.computeScore('v-safe')
    expect(s.score).toBe(0)
    expect(s.level).toBe('LOW')
    expect(s.factors.length).toBe(0)
  })

  it('CVE + 사고 → MEDIUM/HIGH', () => {
    scorer.registerVendor(
      {
        vendorId: 'v-risk',
        name: 'RiskCo',
        country: 'KR',
        category: 'CLOUD',
        certifications: ['ISO27001', 'SOC2'],
        cveCount: 5, // +15
        incidentCount: 3, // +15
        financialStability: 80,
      },
      'buyer',
      'O'
    )
    const s = scorer.computeScore('v-risk')
    expect(s.score).toBe(30)
    expect(s.level).toBe('MEDIUM')
  })

  it('고위험 국가 + 인증 없음 + 재정 불안정 → CRITICAL', () => {
    scorer.addHighRiskCountry('RU')
    scorer.registerVendor(
      {
        vendorId: 'v-crit',
        name: 'CritCo',
        country: 'RU',
        category: 'CLOUD',
        certifications: [],
        cveCount: 10, // +30
        incidentCount: 5, // +25
        financialStability: 30, // +20
      },
      'buyer',
      'O'
    )
    const s = scorer.computeScore('v-crit')
    // 30+25+20+15+10 = 100
    expect(s.score).toBe(100)
    expect(s.level).toBe('CRITICAL')
    expect(s.factors.some((f) => f.includes('고위험 국가'))).toBe(true)
    expect(s.factors.some((f) => f.includes('인증'))).toBe(true)
  })

  it('CVE 상한(30)·사고 상한(25) 검증', () => {
    scorer.registerVendor(
      {
        vendorId: 'v-cap',
        name: 'Cap',
        country: 'KR',
        category: 'CLOUD',
        certifications: ['ISO27001', 'SOC2'],
        cveCount: 100,
        incidentCount: 100,
        financialStability: 80,
      },
      'buyer',
      'O'
    )
    const s = scorer.computeScore('v-cap')
    expect(s.score).toBe(55) // 30+25
  })

  it('removeHighRiskCountry 효과', () => {
    scorer.addHighRiskCountry('KR')
    const s1 = scorer.computeScore('v-safe')
    expect(s1.score).toBeGreaterThanOrEqual(15)
    scorer.removeHighRiskCountry('KR')
    const s2 = scorer.computeScore('v-safe')
    expect(s2.score).toBe(0)
  })

  it('대체 공급업체 추천 — 더 낮은 score 반환', () => {
    scorer.registerVendor(
      {
        vendorId: 'v-risky',
        name: 'R',
        country: 'KR',
        category: 'CLOUD',
        certifications: [],
        cveCount: 10,
        incidentCount: 5,
        financialStability: 30,
      },
      'buyer',
      'O'
    )
    const alts = scorer.recommendAlternatives('v-risky')
    expect(alts.length).toBeGreaterThan(0)
    expect(alts[0]?.vendorId).toBe('v-safe')
    expect(alts[0]?.score).toBeLessThan(scorer.computeScore('v-risky').score)
  })

  it('대체 추천 — 동일 카테고리만', () => {
    scorer.registerVendor(
      {
        vendorId: 'v-other',
        name: 'O',
        country: 'KR',
        category: 'NETWORK',
        certifications: ['ISO27001', 'SOC2'],
        cveCount: 0,
        incidentCount: 0,
        financialStability: 90,
      },
      'buyer',
      'O'
    )
    scorer.registerVendor(
      {
        vendorId: 'v-cloud-risk',
        name: 'Cr',
        country: 'KR',
        category: 'CLOUD',
        certifications: [],
        cveCount: 3,
        incidentCount: 2,
        financialStability: 60,
      },
      'buyer',
      'O'
    )
    const alts = scorer.recommendAlternatives('v-cloud-risk')
    expect(alts.every((a) => a.vendorId !== 'v-other')).toBe(true)
  })

  it('getSummary 집계', () => {
    scorer.registerVendor(
      {
        vendorId: 'v-med',
        name: 'M',
        country: 'KR',
        category: 'CLOUD',
        certifications: ['ISO27001', 'SOC2'],
        cveCount: 5,
        incidentCount: 3,
        financialStability: 80,
      },
      'buyer',
      'O'
    )
    const summary = scorer.getSummary()
    expect(summary.totalVendors).toBe(2)
    expect(summary.byLevel.LOW).toBe(1)
    expect(summary.byLevel.MEDIUM).toBe(1)
  })

  it('감사 로그 — 마스킹', () => {
    const log = scorer.getAuditLog()
    const reg = log.find((e) => e.action === 'vendor.register')
    expect(reg?.callerMasked).toContain('***')
    expect(reg?.detail.vendorId).not.toBe('v-safe')
  })
})
