import { describe, it, expect, beforeEach } from 'vitest'
import { LawImpactAnalyzer } from '../law-impact-analyzer'

describe('LawImpactAnalyzer', () => {
  let a: LawImpactAnalyzer

  beforeEach(() => {
    a = new LawImpactAnalyzer()
    a.registerLaw(
      { lawId: 'pipa', title: '개인정보보호법', domain: '보안' },
      'O',
      'admin'
    )
    a.linkSystem('pipa', 'user-service', 'CORE', 'admin')
    a.linkSystem('pipa', 'audit-service', 'PARTIAL', 'admin')
    a.linkSystem('pipa', 'report-service', 'REFERENCE', 'admin')
  })

  it('C등급 법령 등록 차단', () => {
    expect(() =>
      a.registerLaw({ lawId: 'x', title: 't', domain: 'd' }, 'C', 'c')
    ).toThrow('BLOCKED')
  })

  it('빈 lawId 차단', () => {
    expect(() =>
      a.registerLaw({ lawId: '', title: 't', domain: 'd' }, 'O', 'c')
    ).toThrow('lawId')
  })

  it('중복 lawId 차단', () => {
    expect(() =>
      a.registerLaw({ lawId: 'pipa', title: 't', domain: 'd' }, 'O', 'c')
    ).toThrow('중복 lawId')
  })

  it('없는 law에 system 연결 차단', () => {
    expect(() => a.linkSystem('none', 'sys', 'CORE', 'c')).toThrow('lawId 없음')
  })

  it('빈 systemId 차단', () => {
    expect(() => a.linkSystem('pipa', '', 'CORE', 'c')).toThrow('systemId')
  })

  it('중복 매핑 차단', () => {
    expect(() => a.linkSystem('pipa', 'user-service', 'PARTIAL', 'c')).toThrow('중복 매핑')
  })

  it('없는 law에 change 등록 차단', () => {
    expect(() =>
      a.registerChange(
        {
          changeId: 'c1',
          lawId: 'none',
          changeType: 'AMENDMENT',
          effectiveDate: '2026-05-01',
        },
        'c'
      )
    ).toThrow('lawId 없음')
  })

  it('중복 changeId 차단', () => {
    a.registerChange(
      {
        changeId: 'c1',
        lawId: 'pipa',
        changeType: 'AMENDMENT',
        effectiveDate: '2026-05-01',
      },
      'c'
    )
    expect(() =>
      a.registerChange(
        {
          changeId: 'c1',
          lawId: 'pipa',
          changeType: 'REPEAL',
          effectiveDate: '2026-06-01',
        },
        'c'
      )
    ).toThrow('중복 changeId')
  })

  it('AMENDMENT + CORE → HIGH', () => {
    a.registerChange(
      {
        changeId: 'c1',
        lawId: 'pipa',
        changeType: 'AMENDMENT',
        effectiveDate: '2026-05-01',
      },
      'c'
    )
    const r = a.analyzeImpact('c1')
    const core = r.impactedSystems.find((s) => s.systemId === 'user-service')
    expect(core?.impactLevel).toBe('HIGH')
    expect(r.overallImpact).toBe('HIGH')
  })

  it('REPEAL + CORE → CRITICAL', () => {
    a.registerChange(
      {
        changeId: 'c2',
        lawId: 'pipa',
        changeType: 'REPEAL',
        effectiveDate: '2026-05-01',
      },
      'c'
    )
    const r = a.analyzeImpact('c2')
    const core = r.impactedSystems.find((s) => s.systemId === 'user-service')
    expect(core?.impactLevel).toBe('CRITICAL')
    expect(r.overallImpact).toBe('CRITICAL')
  })

  it('ENACTMENT + REFERENCE → LOW', () => {
    a.registerChange(
      {
        changeId: 'c3',
        lawId: 'pipa',
        changeType: 'ENACTMENT',
        effectiveDate: '2026-05-01',
      },
      'c'
    )
    const r = a.analyzeImpact('c3')
    const ref = r.impactedSystems.find((s) => s.systemId === 'report-service')
    expect(ref?.impactLevel).toBe('LOW')
  })

  it('AMENDMENT + PARTIAL → MED', () => {
    a.registerChange(
      {
        changeId: 'c4',
        lawId: 'pipa',
        changeType: 'AMENDMENT',
        effectiveDate: '2026-05-01',
      },
      'c'
    )
    const r = a.analyzeImpact('c4')
    const partial = r.impactedSystems.find((s) => s.systemId === 'audit-service')
    expect(partial?.impactLevel).toBe('MED')
  })

  it('없는 changeId 분석 오류', () => {
    expect(() => a.analyzeImpact('none')).toThrow('changeId 없음')
  })

  it('impactedSystems 개수 = 매핑 수', () => {
    a.registerChange(
      {
        changeId: 'c5',
        lawId: 'pipa',
        changeType: 'AMENDMENT',
        effectiveDate: '2026-05-01',
      },
      'c'
    )
    const r = a.analyzeImpact('c5')
    expect(r.impactedSystems.length).toBe(3)
  })

  it('매핑 없는 법령 영향 분석 — 빈 목록', () => {
    a.registerLaw({ lawId: 'new-law', title: 't', domain: 'd' }, 'O', 'admin')
    a.registerChange(
      {
        changeId: 'c6',
        lawId: 'new-law',
        changeType: 'REPEAL',
        effectiveDate: '2026-05-01',
      },
      'c'
    )
    const r = a.analyzeImpact('c6')
    expect(r.impactedSystems).toHaveLength(0)
    expect(r.overallImpact).toBe('LOW')
  })

  it('감사 로그 — 마스킹', () => {
    const log = a.getAuditLog()
    const reg = log.find((e) => e.action === 'law.register')
    expect(reg?.callerMasked).toContain('***')
  })
})
