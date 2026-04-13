// Plan SC: SVC-AI-ADV-R439
import { describe, it, expect, beforeEach } from 'vitest'
import { FailureScenarioSimulatorV2 } from '../failure-scenario-simulator-v2'

describe('FailureScenarioSimulatorV2', () => {
  let sim: FailureScenarioSimulatorV2

  beforeEach(() => {
    sim = new FailureScenarioSimulatorV2()
  })

  it('registerScenario — 감사 로그에 scenario.register 기록', () => {
    sim.registerScenario('s1', '네트워크 단절', 'critical')
    const log = sim.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('scenario.register')
  })

  it('registerScenario — critical 시나리오 impactScore=100', () => {
    const s = sim.registerScenario('s1', '테스트', 'critical')
    expect(s.impactScore).toBe(100)
  })

  it('registerScenario — high 시나리오 impactScore=70', () => {
    const s = sim.registerScenario('s1', '테스트', 'high')
    expect(s.impactScore).toBe(70)
  })

  it('registerScenario — medium 시나리오 impactScore=40', () => {
    const s = sim.registerScenario('s1', '테스트', 'medium')
    expect(s.impactScore).toBe(40)
  })

  it('runSimulation — 시뮬레이션 결과 반환 및 감사 로그 기록', () => {
    sim.registerScenario('s1', '테스트', 'high')
    const result = sim.runSimulation('s1')
    expect(result.impactScore).toBe(70)
    expect(result.scenarioId).toBe('s1')
    expect(sim.getAuditLog()).toHaveLength(2)
  })

  it('getActiveScenarios — 등록된 시나리오 반환', () => {
    sim.registerScenario('s1', '테스트1', 'low')
    sim.registerScenario('s2', '테스트2', 'medium')
    expect(sim.getActiveScenarios()).toHaveLength(2)
  })

  it('runSimulation — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    sim.registerScenario('s1', '테스트', 'low')
    expect(() => sim.runSimulation('s1', 'C')).toThrow('BLOCKED')
  })

  it('runSimulation — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    sim.registerScenario('s1', '테스트', 'low')
    expect(() => sim.runSimulation('s1', 'S')).toThrow('N2SF N-05')
  })
})
