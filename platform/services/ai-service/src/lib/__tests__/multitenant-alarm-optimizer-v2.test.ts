import { describe, it, expect, beforeEach } from 'vitest'
import { MultitenantAlarmOptimizerV2 } from '../multitenant-alarm-optimizer-v2'

describe('MultitenantAlarmOptimizerV2', () => {
  let optimizer: MultitenantAlarmOptimizerV2
  beforeEach(() => { optimizer = new MultitenantAlarmOptimizerV2() })

  it('알람 규칙 등록 후 조회 가능', () => {
    const rule = optimizer.registerRule('tenant-1', 'rule-1', 'cpu', 80, 'critical')
    expect(rule.ruleId).toBe('rule-1')
    expect(rule.severity).toBe('critical')
  })

  it('알람 발생 기록 후 통계 집계', () => {
    optimizer.registerRule('tenant-1', 'rule-1', 'cpu', 80, 'critical')
    optimizer.recordAlarm('tenant-1', 'rule-1', 90)
    optimizer.recordAlarm('tenant-1', 'rule-1', 95)
    const stats = optimizer.getAlarmStats('tenant-1')
    expect(stats.find(s => s.ruleId === 'rule-1')?.count).toBe(2)
  })

  it('getHighFrequencyRules: count >= threshold', () => {
    optimizer.registerRule('tenant-1', 'rule-1', 'cpu', 80, 'critical')
    optimizer.registerRule('tenant-1', 'rule-2', 'mem', 70, 'warning')
    optimizer.recordAlarm('tenant-1', 'rule-1', 90)
    optimizer.recordAlarm('tenant-1', 'rule-1', 95)
    optimizer.recordAlarm('tenant-1', 'rule-1', 99)
    const high = optimizer.getHighFrequencyRules(3)
    expect(high.map(r => r.ruleId)).toContain('rule-1')
    expect(high.map(r => r.ruleId)).not.toContain('rule-2')
  })

  it('테넌트별 독립 통계', () => {
    optimizer.registerRule('t1', 'rule-1', 'cpu', 80, 'critical')
    optimizer.registerRule('t2', 'rule-1', 'cpu', 80, 'critical')
    optimizer.recordAlarm('t1', 'rule-1', 90)
    const t1Stats = optimizer.getAlarmStats('t1')
    const t2Stats = optimizer.getAlarmStats('t2')
    expect(t1Stats[0].count).toBe(1)
    expect(t2Stats[0].count).toBe(0)
  })

  it('C등급 데이터 전송 차단', () => {
    optimizer.registerRule('tenant-1', 'rule-1', 'cpu', 80, 'critical')
    expect(() => optimizer.recordAlarm('tenant-1', 'rule-1', 90, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    optimizer.registerRule('tenant-1', 'rule-1', 'cpu', 80, 'critical')
    expect(() => optimizer.recordAlarm('tenant-1', 'rule-1', 90, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    optimizer.registerRule('tenant-1', 'rule-1', 'cpu', 80, 'critical')
    optimizer.recordAlarm('tenant-1', 'rule-1', 90)
    expect(optimizer.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
