// Plan SC: SVC-AI-ADV-R404
import { describe, it, expect, beforeEach } from 'vitest'
import { RegulatoryTextInterpreterAI } from '../regulatory-text-interpreter-ai'

describe('RegulatoryTextInterpreterAI', () => {
  let interpreter: RegulatoryTextInterpreterAI

  beforeEach(() => {
    interpreter = new RegulatoryTextInterpreterAI()
  })

  it('registerRegulation — 감사 로그에 regulation.register 기록', () => {
    interpreter.registerRegulation('reg-1', '개인정보 처리방침', '개인정보를 안전하게 보호해야 한다', 'privacy')
    const log = interpreter.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('regulation.register')
  })

  it('getMandatoryClauses — "해야" 포함 조항 반환', () => {
    interpreter.registerRegulation('r1', '보안', '비밀번호를 변경해야 한다', 'security')
    interpreter.registerRegulation('r2', '개인정보', '데이터를 암호화하여야 한다', 'privacy')
    interpreter.registerRegulation('r3', '일반', '문서를 작성한다', 'general')
    const mandatory = interpreter.getMandatoryClauses()
    expect(mandatory).toHaveLength(2)
    expect(mandatory.map((r) => r.id)).toContain('r1')
    expect(mandatory.map((r) => r.id)).toContain('r2')
  })

  it('getProhibitedClauses — "금지" 포함 조항 반환', () => {
    interpreter.registerRegulation('r1', '보안', '비밀번호 공유 금지', 'security')
    interpreter.registerRegulation('r2', '개인정보', '무단 접근하면 안 된다', 'privacy')
    const prohibited = interpreter.getProhibitedClauses()
    expect(prohibited).toHaveLength(2)
  })

  it('getByCategory — 카테고리별 필터링', () => {
    interpreter.registerRegulation('r1', '보안1', '암호화해야 한다', 'security')
    interpreter.registerRegulation('r2', '보안2', '접근 금지', 'security')
    interpreter.registerRegulation('r3', '개인정보', '보호해야 한다', 'privacy')
    const security = interpreter.getByCategory('security')
    expect(security).toHaveLength(2)
  })

  it('registerRegulation — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => interpreter.registerRegulation('r1', '규정', '내용', 'cat', 'C')).toThrow('BLOCKED')
  })

  it('registerRegulation — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => interpreter.registerRegulation('r1', '규정', '내용', 'cat', 'S')).toThrow('N2SF N-05')
  })

  it('clauseType — 중립 조항 neutral로 분류', () => {
    interpreter.registerRegulation('r1', '일반', '보고서를 작성한다', 'general')
    const byCategory = interpreter.getByCategory('general')
    expect(byCategory[0]!.clauseType).toBe('neutral')
  })

  it('getMandatoryClauses — 빈 목록 반환 (조항 없을 때)', () => {
    expect(interpreter.getMandatoryClauses()).toHaveLength(0)
  })
})
