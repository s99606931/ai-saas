import { describe, it, expect, beforeEach } from 'vitest'
import {
  ModelFairnessEvaluator,
  type ModelProfile,
} from '../model-fairness-evaluator'

describe('ModelFairnessEvaluator', () => {
  let evaluator: ModelFairnessEvaluator

  const model: ModelProfile = {
    modelId: 'M001',
    name: '대출 심사 모델',
    protectedAttribute: '성별',
    grade: 'O',
  }

  const addBalanced = (ev: ModelFairnessEvaluator): void => {
    // 남녀 동일 양성률 (공정)
    for (let i = 0; i < 50; i++) {
      const predicted: 0 | 1 = i < 25 ? 1 : 0
      ev.recordPrediction({ modelId: 'M001', group: '남성', predicted, actual: predicted })
      ev.recordPrediction({ modelId: 'M001', group: '여성', predicted, actual: predicted })
    }
  }

  const addBiased = (ev: ModelFairnessEvaluator): void => {
    // 남성 80% 양성, 여성 20% 양성 (편향)
    for (let i = 0; i < 50; i++) {
      const mPred: 0 | 1 = i < 40 ? 1 : 0
      const fPred: 0 | 1 = i < 10 ? 1 : 0
      ev.recordPrediction({ modelId: 'M001', group: '남성', predicted: mPred, actual: mPred })
      ev.recordPrediction({ modelId: 'M001', group: '여성', predicted: fPred, actual: fPred })
    }
  }

  beforeEach(() => {
    evaluator = new ModelFairnessEvaluator()
    evaluator.registerModel(model)
  })

  it('C등급 모델 차단', () => {
    expect(() =>
      evaluator.registerModel({ ...model, modelId: 'M002', grade: 'C' })
    ).toThrow('BLOCKED')
  })

  it('예측 기록 없으면 에러', () => {
    expect(() => evaluator.calculateDemographicParity('M001')).toThrow('No predictions')
  })

  it('Demographic Parity 계산 — 공정', () => {
    addBalanced(evaluator)
    const result = evaluator.calculateDemographicParity('M001')
    expect(result.groups).toHaveLength(2)
    expect(result.maxMinRatio).toBeGreaterThanOrEqual(0.9)
  })

  it('Equal Opportunity 계산 — 공정', () => {
    addBalanced(evaluator)
    const result = evaluator.calculateEqualOpportunity('M001')
    expect(result.metric).toBe('EQUAL_OPPORTUNITY')
    expect(result.maxMinRatio).toBeGreaterThanOrEqual(0.8)
  })

  it('편향 모델 → BIASED 등급', () => {
    addBiased(evaluator)
    const report = evaluator.evaluateDisparateImpact('M001')
    expect(report.grade).toBe('BIASED')
    expect(report.passesEightyPercentRule).toBe(false)
    expect(report.disparateImpactRatio).toBeLessThan(0.8)
  })

  it('공정 모델 → FAIR 등급', () => {
    addBalanced(evaluator)
    const report = evaluator.evaluateDisparateImpact('M001')
    expect(report.grade).toBe('FAIR')
    expect(report.passesEightyPercentRule).toBe(true)
  })

  it('완화 권고 — BIASED → HIGH priority DATA 포함', () => {
    addBiased(evaluator)
    const advice = evaluator.recommendMitigation('M001')
    expect(advice.length).toBeGreaterThan(0)
    expect(advice.some((a) => a.priority === 'HIGH' && a.category === 'DATA')).toBe(true)
  })

  it('완화 권고 — FAIR → LOW priority 모니터링', () => {
    addBalanced(evaluator)
    const advice = evaluator.recommendMitigation('M001')
    expect(advice.every((a) => a.priority === 'LOW')).toBe(true)
  })

  it('감사 로그 — disparate.impact 기록', () => {
    addBalanced(evaluator)
    evaluator.evaluateDisparateImpact('M001')
    const log = evaluator.getAuditLog()
    expect(log.some((e) => e.action === 'disparate.impact')).toBe(true)
  })
})
