import { describe, it, expect, beforeEach } from 'vitest'
import { DigitalTransformationAssessorV2 } from '../digital-transformation-assessor-v2'

describe('DigitalTransformationAssessorV2', () => {
  let assessor: DigitalTransformationAssessorV2

  beforeEach(() => {
    assessor = new DigitalTransformationAssessorV2()
  })

  it('조직 등록 후 조회 가능', () => {
    const org = assessor.registerOrg('org-1', '행정안전부')
    expect(org.orgId).toBe('org-1')
    expect(org.name).toBe('행정안전부')
  })

  it('카테고리 점수 기록 후 평균 계산', () => {
    assessor.registerOrg('org-1', '행정안전부')
    assessor.recordCategoryScore('org-1', 'strategy', 80)
    assessor.recordCategoryScore('org-1', 'technology', 60)
    const score = assessor.getTransformationScore('org-1')
    expect(score).toBe(70)
  })

  it('점수 없으면 0', () => {
    assessor.registerOrg('org-1', '행정안전부')
    expect(assessor.getTransformationScore('org-1')).toBe(0)
  })

  it('leading 단계: 75 이상', () => {
    assessor.registerOrg('org-1', '행정안전부')
    assessor.recordCategoryScore('org-1', 'strategy', 80)
    expect(assessor.getTransformationStage('org-1')).toBe('leading')
  })

  it('progressing 단계: 50 이상 75 미만', () => {
    assessor.registerOrg('org-1', '행정안전부')
    assessor.recordCategoryScore('org-1', 'strategy', 60)
    expect(assessor.getTransformationStage('org-1')).toBe('progressing')
  })

  it('initiating 단계: 25 이상 50 미만', () => {
    assessor.registerOrg('org-1', '행정안전부')
    assessor.recordCategoryScore('org-1', 'strategy', 30)
    expect(assessor.getTransformationStage('org-1')).toBe('initiating')
  })

  it('lagging 단계: 25 미만', () => {
    assessor.registerOrg('org-1', '행정안전부')
    assessor.recordCategoryScore('org-1', 'strategy', 10)
    expect(assessor.getTransformationStage('org-1')).toBe('lagging')
  })

  it('C등급 데이터 전송 차단', () => {
    assessor.registerOrg('org-1', '행정안전부')
    expect(() => assessor.recordCategoryScore('org-1', 'strategy', 80, 'C')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    assessor.registerOrg('org-1', '행정안전부')
    assessor.recordCategoryScore('org-1', 'strategy', 80)
    const log = assessor.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
