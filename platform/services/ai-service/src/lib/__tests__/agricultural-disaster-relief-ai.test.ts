// Plan SC: SVC-AI-ADV-R633
import { describe, it, expect, beforeEach } from 'vitest'
import { AgriculturalDisasterReliefAI } from '../agricultural-disaster-relief-ai'

describe('AgriculturalDisasterReliefAI', () => {
  let ai: AgriculturalDisasterReliefAI

  beforeEach(() => {
    ai = new AgriculturalDisasterReliefAI()
  })

  const baseReport = (overrides = {}) => ({
    reportId: 'r1',
    farmerId: 'f1',
    disasterType: 'typhoon' as const,
    affectedAreaHa: 10,
    cropValuePerHa: 2000000,
    lossRatio: 0.6,
    ...overrides,
  })

  it('submitReport — 감사 로그 기록', () => {
    ai.submitReport(baseReport())
    expect(ai.getAuditLog()[0]!.action).toBe('report.submit')
  })

  it('submitReport — 잘못된 lossRatio 거부', () => {
    expect(() => ai.submitReport(baseReport({ lossRatio: 1.5 }))).toThrow()
  })

  it('evaluateRelief — 태풍 피해액 계산 정확도', () => {
    ai.submitReport(baseReport())
    const d = ai.evaluateRelief('r1')
    expect(d.estimatedLoss).toBe(12000000)
    expect(d.reliefAmount).toBe(9600000)
  })

  it('evaluateRelief — 대규모 피해는 urgent', () => {
    ai.submitReport(baseReport())
    const d = ai.evaluateRelief('r1')
    expect(d.priority).toBe('urgent')
  })

  it('listUrgent — urgent 건만 반환', () => {
    ai.submitReport(baseReport())
    ai.submitReport(baseReport({ reportId: 'r2', affectedAreaHa: 0.5, lossRatio: 0.2 }))
    expect(ai.listUrgent()).toHaveLength(1)
  })

  it('submitReport — C등급 차단', () => {
    expect(() => ai.submitReport(baseReport(), 'C')).toThrow('BLOCKED')
  })
})
