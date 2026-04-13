import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentAlertFilterAi, type AlertRule, type AlertEvent } from '../intelligent-alert-filter-ai'

describe('IntelligentAlertFilterAi', () => {
  let filter: IntelligentAlertFilterAi

  const rule: AlertRule = {
    ruleId: 'RULE001',
    name: '인프라 알림',
    category: 'INFRASTRUCTURE',
    minSeverityToForward: 'MEDIUM',
    suppressDuplicateWindowMs: 60_000,
    escalateAfterCount: 3,
  }

  const makeEvent = (id: string, severity: AlertEvent['severity'], message = '서버 이상'): AlertEvent => ({
    alertId: id,
    ruleId: 'RULE001',
    severity,
    message,
    timestamp: Date.now(),
    source: 'prometheus',
  })

  beforeEach(() => {
    filter = new IntelligentAlertFilterAi()
    filter.registerRule(rule)
  })

  it('룰 등록 감사 로그', () => {
    const log = filter.getAuditLog()
    expect(log.some((e) => e.action === 'rule.register')).toBe(true)
  })

  it('MEDIUM 이상 → FORWARD', () => {
    const result = filter.filter(makeEvent('A001', 'HIGH'))
    expect(result.action).toBe('FORWARD')
    expect(result.forwarded).toBe(true)
  })

  it('LOW 심각도 → SUPPRESS', () => {
    const result = filter.filter(makeEvent('A002', 'LOW'))
    expect(result.action).toBe('SUPPRESS')
    expect(result.forwarded).toBe(false)
  })

  it('중복 메시지 → DEDUPLICATE', () => {
    const now = Date.now()
    filter.filter({ ...makeEvent('A003', 'HIGH'), timestamp: now })
    const result = filter.filter({ ...makeEvent('A004', 'HIGH'), timestamp: now + 1000 })
    expect(result.action).toBe('DEDUPLICATE')
    expect(result.forwarded).toBe(false)
  })

  it('반복 알림 N회 초과 → ESCALATE', () => {
    const now = Date.now()
    // 3번 먼저 발생 (각기 다른 메시지)
    filter.filter({ ...makeEvent('A005', 'HIGH', '이슈1'), timestamp: now })
    filter.filter({ ...makeEvent('A006', 'HIGH', '이슈2'), timestamp: now + 1000 })
    filter.filter({ ...makeEvent('A007', 'HIGH', '이슈3'), timestamp: now + 2000 })
    // 4번째 → ESCALATE (recentSameRule.length = 3 >= escalateAfterCount 3)
    const result = filter.filter({ ...makeEvent('A008', 'CRITICAL', '이슈4'), timestamp: now + 3000 })
    expect(result.action).toBe('ESCALATE')
    expect(result.forwarded).toBe(true)
  })

  it('CRITICAL 항상 전달', () => {
    const result = filter.filter(makeEvent('A009', 'CRITICAL', '긴급 장애'))
    expect(result.forwarded).toBe(true)
  })

  it('미등록 룰 에러', () => {
    expect(() => filter.filter({ ...makeEvent('X1', 'HIGH'), ruleId: 'UNKNOWN' })).toThrow()
  })

  it('필터링 후 감사 로그', () => {
    filter.filter(makeEvent('A010', 'HIGH'))
    const log = filter.getAuditLog()
    expect(log.some((e) => e.action === 'alert.filter')).toBe(true)
  })
})
