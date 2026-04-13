import { describe, it, expect, beforeEach } from 'vitest'
import { AiClimateAdaptationPlanner } from '../ai-climate-adaptation-planner.js'

describe('AiClimateAdaptationPlanner (FR-R507.1)', () => {
  let svc: AiClimateAdaptationPlanner

  beforeEach(() => {
    svc = new AiClimateAdaptationPlanner()
  })

  it('낮은 위험 — LOW + 기본 모니터링 액션', () => {
    const plan = svc.generatePlan(
      {
        region: '제주',
        avgTempIncreaseC: 0.3,
        precipitationChangePct: 5,
        extremeEventsPerYear: 0,
        seaLevelRiseCm: 1,
      },
      'O'
    )
    expect(plan.riskLevel).toBe('LOW')
    expect(plan.actions.length).toBeGreaterThan(0)
  })

  it('고온 → 폭염 대피소 액션', () => {
    const plan = svc.generatePlan(
      {
        region: '대구',
        avgTempIncreaseC: 2.0,
        precipitationChangePct: 0,
        extremeEventsPerYear: 1,
        seaLevelRiseCm: 0,
      },
      'O'
    )
    expect(plan.actions.some((a) => a.actionId === 'HEAT_001')).toBe(true)
  })

  it('극단 기상 빈발 → 인프라 강화 + HIGH/SEVERE', () => {
    const plan = svc.generatePlan(
      {
        region: '강원',
        avgTempIncreaseC: 1.8,
        precipitationChangePct: 30,
        extremeEventsPerYear: 6,
        seaLevelRiseCm: 0,
      },
      'O'
    )
    expect(plan.actions.some((a) => a.actionId === 'INFRA_001')).toBe(true)
    expect(['HIGH', 'SEVERE']).toContain(plan.riskLevel)
  })

  it('해수면 상승 → COAST 액션', () => {
    const plan = svc.generatePlan(
      {
        region: '인천',
        avgTempIncreaseC: 0.5,
        precipitationChangePct: 0,
        extremeEventsPerYear: 0,
        seaLevelRiseCm: 8,
      },
      'O'
    )
    expect(plan.actions.some((a) => a.actionId === 'COAST_001')).toBe(true)
  })

  it('C 등급 차단', () => {
    expect(() =>
      svc.generatePlan(
        {
          region: '서울',
          avgTempIncreaseC: 1,
          precipitationChangePct: 5,
          extremeEventsPerYear: 1,
          seaLevelRiseCm: 0,
        },
        'C'
      )
    ).toThrow(/BLOCKED/)
  })

  it('감사 로그 기록', () => {
    svc.generatePlan(
      {
        region: '광주',
        avgTempIncreaseC: 1,
        precipitationChangePct: 5,
        extremeEventsPerYear: 1,
        seaLevelRiseCm: 0,
      },
      'O'
    )
    expect(svc.getAuditLog().length).toBeGreaterThanOrEqual(1)
  })
})
