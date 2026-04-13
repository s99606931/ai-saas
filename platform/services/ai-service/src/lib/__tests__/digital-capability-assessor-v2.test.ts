// Design Ref: §R426 — Workforce Planning AI
import { describe, it, expect, beforeEach } from 'vitest'
import { DigitalCapabilityAssessorV2 } from '../digital-capability-assessor-v2'

describe('DigitalCapabilityAssessorV2 (Workforce Planner)', () => {
  let planner: DigitalCapabilityAssessorV2

  beforeEach(() => {
    planner = new DigitalCapabilityAssessorV2()
  })

  it('INCREASE: loadPerHead > threshold*1.2', () => {
    planner.registerDept({ deptId: 'DEPT-A', workload: 1500, headcount: 10 })
    // loadPerHead=150, threshold=100, 150>120 → INCREASE
    const report = planner.plan(100)
    const advice = report.advices.find((a) => a.deptId === 'DEPT-A')
    expect(advice?.action).toBe('INCREASE')
  })

  it('DECREASE: loadPerHead < threshold*0.6', () => {
    planner.registerDept({ deptId: 'DEPT-B', workload: 200, headcount: 10 })
    // loadPerHead=20, threshold=100, 20<60 → DECREASE
    const report = planner.plan(100)
    const advice = report.advices.find((a) => a.deptId === 'DEPT-B')
    expect(advice?.action).toBe('DECREASE')
  })

  it('MAINTAIN: 60 ≤ loadPerHead ≤ 120', () => {
    planner.registerDept({ deptId: 'DEPT-C', workload: 900, headcount: 10 })
    // loadPerHead=90 → MAINTAIN
    const report = planner.plan(100)
    const advice = report.advices.find((a) => a.deptId === 'DEPT-C')
    expect(advice?.action).toBe('MAINTAIN')
  })

  it('top3Increase: INCREASE 필요 delta 큰 순 최대 3개', () => {
    for (let i = 1; i <= 5; i++) {
      planner.registerDept({ deptId: `DEPT-${i}`, workload: i * 500, headcount: 2 })
    }
    const report = planner.plan(100)
    expect(report.top3Increase.length).toBeLessThanOrEqual(3)
  })

  it('neededDelta: round(workload/threshold) - headcount', () => {
    planner.registerDept({ deptId: 'DEPT-D', workload: 1500, headcount: 10 })
    const report = planner.plan(100)
    const advice = report.advices.find((a) => a.deptId === 'DEPT-D')
    // round(1500/100) - 10 = 15-10 = 5
    expect(advice?.neededDelta).toBe(5)
  })

  it('감사 로그에 workforce.plan 기록', () => {
    planner.registerDept({ deptId: 'DEPT-E', workload: 100, headcount: 1 })
    planner.plan()
    const logs = planner.getAuditLog()
    expect(logs.some((l) => l.action === 'workforce.plan')).toBe(true)
  })
})
