import { describe, it, expect, beforeEach } from 'vitest'
import { AiAuditAutomation, type ChecklistItem } from '../ai-audit-automation'

describe('AiAuditAutomation', () => {
  let a: AiAuditAutomation
  const items: ChecklistItem[] = [
    { itemId: 'D-08-1', clause: 'CSAP D-08', description: 'RBAC', severity: 'HIGH' },
    { itemId: 'D-09-1', clause: 'CSAP D-09', description: 'AES-256', severity: 'HIGH' },
    { itemId: 'D-06-1', clause: 'CSAP D-06', description: '감사 로그', severity: 'MED' },
    { itemId: 'D-12-1', clause: 'CSAP D-12', description: '입력 검증', severity: 'LOW' },
  ]

  beforeEach(() => {
    a = new AiAuditAutomation()
    a.registerChecklist(items, 'admin-audit')
  })

  it('빈 checklist 차단', () => {
    const fresh = new AiAuditAutomation()
    expect(() => fresh.registerChecklist([], 'a')).toThrow('items')
  })

  it('중복 itemId 차단', () => {
    expect(() =>
      a.registerChecklist(
        [{ itemId: 'D-08-1', clause: 'x', description: 'y', severity: 'LOW' }],
        'c'
      )
    ).toThrow('중복')
  })

  it('C등급 증적 차단', () => {
    expect(() => a.submitEvidence('D-08-1', 'proof', 'PASS', 'C', 'a')).toThrow('BLOCKED')
  })

  it('없는 itemId 증적 차단', () => {
    expect(() => a.submitEvidence('none', 'proof', 'PASS', 'O', 'a')).toThrow('itemId 없음')
  })

  it('빈 증적 내용 차단', () => {
    expect(() => a.submitEvidence('D-08-1', '  ', 'PASS', 'O', 'a')).toThrow('content')
  })

  it('PASS 증적 — compliance 상승', () => {
    a.submitEvidence('D-08-1', 'RBAC 구현', 'PASS', 'O', 'a')
    a.submitEvidence('D-09-1', 'AES-256 사용', 'PASS', 'O', 'a')
    a.submitEvidence('D-06-1', '감사 로그 구현', 'PASS', 'O', 'a')
    a.submitEvidence('D-12-1', 'Zod 스키마', 'PASS', 'O', 'a')
    const r = a.runAudit('auditor')
    expect(r.passCount).toBe(4)
    expect(r.compliancePct).toBe(100)
    expect(r.riskScore).toBe(0)
  })

  it('FAIL 항목 — 리스크 점수', () => {
    a.submitEvidence('D-08-1', '미구현', 'FAIL', 'O', 'a')
    a.submitEvidence('D-09-1', '미구현', 'FAIL', 'O', 'a')
    a.submitEvidence('D-06-1', '감사', 'PASS', 'O', 'a')
    a.submitEvidence('D-12-1', '검증', 'PASS', 'O', 'a')
    const r = a.runAudit('auditor')
    expect(r.failCount).toBe(2)
    expect(r.riskScore).toBe(10) // HIGH*2 = 5*2
    expect(r.failedItems.length).toBe(2)
  })

  it('PENDING 항목 — 증적 없음', () => {
    a.submitEvidence('D-08-1', 'PASS', 'PASS', 'O', 'a')
    const r = a.runAudit('auditor')
    expect(r.pendingCount).toBe(3)
    expect(r.passCount).toBe(1)
  })

  it('혼합 상태 리포트', () => {
    a.submitEvidence('D-08-1', 'pass', 'PASS', 'O', 'a')
    a.submitEvidence('D-09-1', 'fail', 'FAIL', 'O', 'a') // HIGH = 5
    a.submitEvidence('D-06-1', 'fail', 'FAIL', 'O', 'a') // MED = 3
    a.submitEvidence('D-12-1', 'fail', 'FAIL', 'O', 'a') // LOW = 1
    const r = a.runAudit('auditor')
    expect(r.passCount).toBe(1)
    expect(r.failCount).toBe(3)
    expect(r.riskScore).toBe(9)
    expect(r.compliancePct).toBe(25)
  })

  it('PENDING 증적 상태', () => {
    a.submitEvidence('D-08-1', '검토 중', 'PENDING', 'O', 'a')
    const r = a.runAudit('auditor')
    expect(r.pendingCount).toBe(4) // 1개 pending + 3개 증적 없음
  })

  it('체크리스트 없이 runAudit — 빈 오류', () => {
    const empty = new AiAuditAutomation()
    expect(() => empty.runAudit('a')).toThrow('체크리스트')
  })

  it('failedItems 상세 포함', () => {
    a.submitEvidence('D-08-1', 'fail', 'FAIL', 'O', 'a')
    const r = a.runAudit('auditor')
    expect(r.failedItems[0]?.itemId).toBe('D-08-1')
    expect(r.failedItems[0]?.severity).toBe('HIGH')
    expect(r.failedItems[0]?.clause).toContain('D-08')
  })

  it('감사 로그 — 마스킹', () => {
    const log = a.getAuditLog()
    const reg = log.find((e) => e.action === 'checklist.register')
    expect(reg?.callerMasked).toContain('***')
  })

  it('증적 재제출 — 덮어쓰기', () => {
    a.submitEvidence('D-08-1', '1차', 'FAIL', 'O', 'a')
    a.submitEvidence('D-08-1', '2차', 'PASS', 'O', 'a')
    const r = a.runAudit('a')
    expect(r.passCount).toBe(1)
  })
})
