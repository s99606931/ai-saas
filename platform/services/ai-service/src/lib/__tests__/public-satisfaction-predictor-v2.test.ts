// Design Ref: §R389 — AI기반 공공 서비스 만족도 예측 v2
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicSatisfactionPredictorV2, type SatisfactionSurvey } from '../public-satisfaction-predictor-v2'

describe('PublicSatisfactionPredictorV2', () => {
  let predictor: PublicSatisfactionPredictorV2

  const makeSurvey = (overrides: Partial<SatisfactionSurvey> = {}): SatisfactionSurvey => ({
    surveyId: 'sv-01',
    serviceId: 'svc-test',
    userId: 'user123456',
    score: 80,
    waitTimeMinutes: 5,
    processSteps: 2,
    resolvedAtFirstContact: true,
    channel: 'ONLINE',
    ...overrides,
  })

  beforeEach(() => {
    predictor = new PublicSatisfactionPredictorV2()
  })

  it('데이터 없음: 기본 예측 반환 (50점, MEDIUM)', () => {
    const result = predictor.predict('empty-svc')
    expect(result.predictedScore).toBe(50)
    expect(result.riskLevel).toBe('MEDIUM')
  })

  it('HIGH 리스크: 예측 점수 60 미만', () => {
    predictor.submitSurvey(makeSurvey({ score: 55, waitTimeMinutes: 40, resolvedAtFirstContact: false, processSteps: 7 }))
    const result = predictor.predict('svc-test')
    expect(result.riskLevel).toBe('HIGH')
  })

  it('LOW 리스크: 예측 점수 75 이상', () => {
    predictor.submitSurvey(makeSurvey({ score: 90, waitTimeMinutes: 5, resolvedAtFirstContact: true, processSteps: 2 }))
    const result = predictor.predict('svc-test')
    expect(result.riskLevel).toBe('LOW')
  })

  it('키 요인: 첫 접촉 해결률 80% 이상 → POSITIVE', () => {
    for (let i = 0; i < 5; i++) {
      predictor.submitSurvey(makeSurvey({ surveyId: `sv-${i}`, resolvedAtFirstContact: i < 4 }))
    }
    const result = predictor.predict('svc-test')
    const factor = result.keyFactors.find((f) => f.factor === '첫 접촉 해결률')
    expect(factor?.impact).toBe('POSITIVE')
  })

  it('권고사항: 대기시간 30분 초과 → 권고 포함', () => {
    predictor.submitSurvey(makeSurvey({ waitTimeMinutes: 35 }))
    const result = predictor.predict('svc-test')
    expect(result.recommendations.some((r) => r.includes('대기시간'))).toBe(true)
  })

  it('PII: 감사 로그에 userId 마스킹', () => {
    predictor.submitSurvey(makeSurvey({ userId: 'user123456' }))
    const logs = predictor.getAuditLog()
    const submitLog = logs.find((l) => l.action === 'survey.submit')
    expect(submitLog?.detail).not.toContain('user123456')
    expect(submitLog?.detail).toContain('*')
  })

  it('감사 로그에 predict 기록', () => {
    predictor.submitSurvey(makeSurvey())
    predictor.predict('svc-test')
    const logs = predictor.getAuditLog()
    expect(logs.some((l) => l.action === 'satisfaction.predict')).toBe(true)
  })
})
