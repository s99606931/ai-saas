// Plan SC: SVC-AI-ADV-R377
import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityPatchManagerAI } from '../security-patch-manager-ai'

describe('SecurityPatchManagerAI', () => {
  let manager: SecurityPatchManagerAI

  beforeEach(() => {
    manager = new SecurityPatchManagerAI()
  })

  it('registerCve — 감사 로그에 cve.register 기록', () => {
    manager.registerCve('CVE-001', 'critical', 'openssh')
    const log = manager.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('cve.register')
    expect(log[0]!.detail).toBe('CVE-001:critical')
  })

  it('getPriorityList — 심각도 내림차순 정렬 (pending만)', () => {
    manager.registerCve('CVE-001', 'low', 'comp-a')
    manager.registerCve('CVE-002', 'critical', 'comp-b')
    manager.registerCve('CVE-003', 'high', 'comp-c')
    const list = manager.getPriorityList()
    expect(list[0]!.id).toBe('CVE-002') // critical first
    expect(list[1]!.id).toBe('CVE-003') // high second
    expect(list[2]!.id).toBe('CVE-001') // low last
  })

  it('getPriorityList — applied 상태는 제외', () => {
    manager.registerCve('CVE-001', 'critical', 'comp-a')
    manager.updatePatchStatus('CVE-001', 'applied')
    const list = manager.getPriorityList()
    expect(list).toHaveLength(0)
  })

  it('getPendingCritical — critical+pending 항목만 반환', () => {
    manager.registerCve('CVE-001', 'critical', 'comp-a')
    manager.registerCve('CVE-002', 'high', 'comp-b')
    manager.registerCve('CVE-003', 'critical', 'comp-c')
    manager.updatePatchStatus('CVE-001', 'applied')
    const critical = manager.getPendingCritical()
    expect(critical).toHaveLength(1)
    expect(critical[0]!.id).toBe('CVE-003')
  })

  it('updatePatchStatus — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    manager.registerCve('CVE-001', 'critical', 'comp-a')
    expect(() => manager.updatePatchStatus('CVE-001', 'applied', 'C')).toThrow('BLOCKED')
  })

  it('updatePatchStatus — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    manager.registerCve('CVE-001', 'critical', 'comp-a')
    expect(() => manager.updatePatchStatus('CVE-001', 'applied', 'S')).toThrow('N2SF N-05')
  })

  it('updatePatchStatus — 없는 cveId 에러', () => {
    expect(() => manager.updatePatchStatus('NONEXISTENT', 'applied')).toThrow('cveId 없음')
  })

  it('registerCve — 필수 파라미터 누락 시 에러', () => {
    expect(() => manager.registerCve('', 'critical', 'comp')).toThrow('필수')
  })
})
