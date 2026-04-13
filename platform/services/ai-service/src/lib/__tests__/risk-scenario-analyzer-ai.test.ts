// Plan SC: SVC-AI-ADV-R458-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { RiskScenarioAnalyzerAI, type RiskScenario } from '../risk-scenario-analyzer-ai'

describe('RiskScenarioAnalyzerAI', () => {
  let analyzer: RiskScenarioAnalyzerAI

  beforeEach(() => {
    analyzer = new RiskScenarioAnalyzerAI()
  })

  const highRiskScenario: RiskScenario = {
    scenarioId: 'SC-1',
    name: '사이버 공격 시나리오',
    factors: [
      { factorId: 'F1', category: 'SECURITY', probability: 0.9, impact: 0.9, description: '랜섬웨어 공격' },
      { factorId: 'F2', category: 'OPERATIONAL', probability: 0.7, impact: 0.8, description: '서비스 중단' },
    ],
  }

  it('미등록 시나리오 분석 시 오류 발생', () => {
    expect(() => analyzer.analyze('UNKNOWN')).toThrow('Unknown scenario')
  })

  it('요인 없는 시나리오 → LOW 위험도', () => {
    analyzer.registerScenario({ scenarioId: 'SC-EMPTY', name: '빈 시나리오', factors: [] })
    const result = analyzer.analyze('SC-EMPTY')
    expect(result.riskLevel).toBe('LOW')
    expect(result.overallRiskScore).toBe(0)
  })

  it('고확률 고영향 요인 → CRITICAL 위험도', () => {
    analyzer.registerScenario(highRiskScenario)
    const result = analyzer.analyze('SC-1')
    expect(result.riskLevel).toBe('CRITICAL')
    expect(result.overallRiskScore).toBeGreaterThanOrEqual(70)
  })

  it('topFactors: 최대 3개 반환, 내림차순 정렬', () => {
    analyzer.registerScenario(highRiskScenario)
    const result = analyzer.analyze('SC-1')
    expect(result.topFactors.length).toBeLessThanOrEqual(3)
    if (result.topFactors.length >= 2) {
      expect(result.topFactors[0]!.riskScore).toBeGreaterThanOrEqual(result.topFactors[1]!.riskScore)
    }
  })

  it('보안 카테고리 요인 → 보안 완화 전략 포함', () => {
    analyzer.registerScenario(highRiskScenario)
    const result = analyzer.analyze('SC-1')
    expect(result.mitigations.some((m) => m.includes('보안'))).toBe(true)
  })

  it('낮은 위험 → ACCEPTABLE outcome', () => {
    analyzer.registerScenario({
      scenarioId: 'SC-LOW',
      name: '저위험 시나리오',
      factors: [{ factorId: 'F1', category: 'OPERATIONAL', probability: 0.1, impact: 0.1, description: '소규모 장애' }],
    })
    const result = analyzer.analyze('SC-LOW')
    expect(result.outcome).toBe('ACCEPTABLE')
  })

  it('generatedAt 포함', () => {
    analyzer.registerScenario(highRiskScenario)
    const result = analyzer.analyze('SC-1')
    expect(result.generatedAt).toBeTruthy()
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    analyzer.registerScenario(highRiskScenario)
    analyzer.analyze('SC-1')
    const log1 = analyzer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', scenarioId: 'X', detail: {} })
    const log2 = analyzer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
