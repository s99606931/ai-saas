import { describe, it, expect, beforeEach } from 'vitest'
import { SlaAutomationV3 } from '../sla-automation-v3'

describe('SlaAutomationV3', () => {
  let sla: SlaAutomationV3
  beforeEach(() => { sla = new SlaAutomationV3() })

  it('SLA 계약 등록 후 조회', () => {
    const c = sla.registerContract('c-1', 'svc-1', '가용성', 99.9, '%')
    expect(c.contractId).toBe('c-1')
    expect(c.targetValue).toBe(99.9)
  })

  it('달성률 계산: actual/target*100', () => {
    sla.registerContract('c-1', 'svc-1', '가용성', 100, '%')
    sla.recordActual('c-1', 80)
    expect(sla.getComplianceRate('c-1')).toBe(80)
  })

  it('달성률 100%: 미달성 목록 제외', () => {
    sla.registerContract('c-1', 'svc-1', '가용성', 100, '%')
    sla.recordActual('c-1', 100)
    expect(sla.getBreachedSlas().map(c => c.contractId)).not.toContain('c-1')
  })

  it('getBreachedSlas: 미달성 반환', () => {
    sla.registerContract('c-1', 'svc-1', '가용성', 100, '%')
    sla.registerContract('c-2', 'svc-2', '응답시간', 200, 'ms')
    sla.recordActual('c-1', 80)
    sla.recordActual('c-2', 200)
    const breached = sla.getBreachedSlas()
    expect(breached.map(c => c.contractId)).toContain('c-1')
    expect(breached.map(c => c.contractId)).not.toContain('c-2')
  })

  it('C등급 데이터 전송 차단', () => {
    sla.registerContract('c-1', 'svc-1', '가용성', 100, '%')
    expect(() => sla.recordActual('c-1', 80, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    sla.registerContract('c-1', 'svc-1', '가용성', 100, '%')
    expect(() => sla.recordActual('c-1', 80, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    sla.registerContract('c-1', 'svc-1', '가용성', 100, '%')
    sla.recordActual('c-1', 80)
    expect(sla.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
