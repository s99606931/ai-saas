import { describe, it, expect, beforeEach } from 'vitest'
import { DigitalTransformationAssessorAi, type DtDimension, type DtAssessmentInput } from '../digital-transformation-assessor-ai'

describe('DigitalTransformationAssessorAi', () => {
  let ai: DigitalTransformationAssessorAi

  const dim: DtDimension = { dimensionId: 'DIM001', name: '클라우드 전환', weight: 1 }

  const input: DtAssessmentInput = {
    orgId: 'ORG001',
    orgName: '행정안전부',
    scores: [{ dimensionId: 'DIM001', score: 80 }],
  }

  beforeEach(() => {
    ai = new DigitalTransformationAssessorAi()
    ai.registerDimension(dim)
  })

  it('차원 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'dimension.register')).toBe(true)
  })

  it('80점 → MANAGED 성숙도', () => {
    const result = ai.assess({ ...input, scores: [{ dimensionId: 'DIM001', score: 80 }] })
    expect(result.maturityLevel).toBe('MANAGED')
    expect(result.overallScore).toBe(80)
  })

  it('90점 이상 → OPTIMIZING', () => {
    const result = ai.assess({ ...input, scores: [{ dimensionId: 'DIM001', score: 95 }] })
    expect(result.maturityLevel).toBe('OPTIMIZING')
  })

  it('40점 미만 → INITIAL', () => {
    const result = ai.assess({ ...input, scores: [{ dimensionId: 'DIM001', score: 30 }] })
    expect(result.maturityLevel).toBe('INITIAL')
  })

  it('점수 60 미만 → WEAK + recommendations', () => {
    const result = ai.assess({ ...input, scores: [{ dimensionId: 'DIM001', score: 40 }] })
    expect(result.dimensionResults[0]?.status).toBe('WEAK')
    expect(result.recommendations.some((r) => r.includes('클라우드 전환'))).toBe(true)
    expect(result.gaps).toContain('클라우드 전환')
  })

  it('점수 80 이상 → STRONG', () => {
    const result = ai.assess(input)
    expect(result.dimensionResults[0]?.status).toBe('STRONG')
  })

  it('다중 차원 가중 평균', () => {
    ai.registerDimension({ dimensionId: 'DIM002', name: '데이터 활용', weight: 3 })
    const result = ai.assess({
      orgId: 'ORG001',
      orgName: '테스트',
      scores: [
        { dimensionId: 'DIM001', score: 100 },
        { dimensionId: 'DIM002', score: 60 },
      ],
    })
    // weight 1:3 → (100*1 + 60*3) / 4 = 70
    expect(result.overallScore).toBe(70)
  })

  it('평가 후 감사 로그', () => {
    ai.assess(input)
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'dt.assess')).toBe(true)
  })
})
