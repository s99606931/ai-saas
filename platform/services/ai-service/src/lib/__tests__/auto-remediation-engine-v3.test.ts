import { describe, it, expect, beforeEach } from 'vitest'
import { AutoRemediationEngineV3 } from '../auto-remediation-engine-v3'

describe('AutoRemediationEngineV3', () => {
  let engine: AutoRemediationEngineV3

  beforeEach(() => {
    engine = new AutoRemediationEngineV3()
  })

  it('N2SF C등급 시그널 차단', () => {
    engine.registerPlaybook({
      playbookId: 'pb1',
      signalType: 'cpu_high',
      minSeverity: 'LOW',
      priority: 1,
      action: 'restart',
    })
    expect(() =>
      engine.matchPlaybooks(
        { signalId: 'sig1', signalType: 'cpu_high', severity: 'HIGH', receivedAt: '' },
        'C',
      ),
    ).toThrow('BLOCKED')
  })

  it('signalType 일치 + severity 충분 → 매칭', () => {
    engine.registerPlaybook({
      playbookId: 'pb2',
      signalType: 'oom',
      minSeverity: 'HIGH',
      priority: 5,
      action: 'restart',
    })
    const matches = engine.matchPlaybooks({
      signalId: 's',
      signalType: 'oom',
      severity: 'CRITICAL',
      receivedAt: '',
    })
    expect(matches.length).toBe(1)
    expect(matches[0]!.playbookId).toBe('pb2')
  })

  it('우선순위 desc 정렬', () => {
    engine.registerPlaybook({
      playbookId: 'low',
      signalType: 'x',
      minSeverity: 'LOW',
      priority: 1,
      action: 'a',
    })
    engine.registerPlaybook({
      playbookId: 'high',
      signalType: 'x',
      minSeverity: 'LOW',
      priority: 10,
      action: 'b',
    })
    const matches = engine.matchPlaybooks({
      signalId: 's',
      signalType: 'x',
      severity: 'MEDIUM',
      receivedAt: '',
    })
    expect(matches[0]!.playbookId).toBe('high')
  })

  it('실행 결과 + 통계', () => {
    engine.registerPlaybook({
      playbookId: 'pb3',
      signalType: 'x',
      minSeverity: 'LOW',
      priority: 1,
      action: 'a',
    })
    engine.executePlaybook('pb3', 'sig1', () => true)
    engine.executePlaybook('pb3', 'sig2', () => false)
    const stats = engine.getStats()
    expect(stats.total).toBe(2)
    expect(stats.successes).toBe(1)
    expect(stats.successRate).toBeCloseTo(0.5, 5)
  })

  it('실행 중 예외 → success=false + error 기록', () => {
    engine.registerPlaybook({
      playbookId: 'pb4',
      signalType: 'x',
      minSeverity: 'LOW',
      priority: 1,
      action: 'a',
    })
    const exec = engine.executePlaybook('pb4', 'sig', () => {
      throw new Error('boom')
    })
    expect(exec.success).toBe(false)
    expect(exec.error).toBe('boom')
  })

  it('감사 로그 복사본 반환', () => {
    engine.registerPlaybook({
      playbookId: 'pb5',
      signalType: 'x',
      minSeverity: 'LOW',
      priority: 1,
      action: 'a',
    })
    const log = engine.getAuditLog()
    log.push({ timestamp: '', action: 'injected', playbookId: 'X', detail: {} })
    expect(engine.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
