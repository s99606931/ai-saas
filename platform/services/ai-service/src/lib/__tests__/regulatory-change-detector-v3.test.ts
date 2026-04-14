// Plan SC: SVC-AI-ADV-R615
import { describe, it, expect, beforeEach } from 'vitest'
import { RegulatoryChangeDetectorV3 } from '../regulatory-change-detector-v3'

describe('RegulatoryChangeDetectorV3', () => {
  let d: RegulatoryChangeDetectorV3

  beforeEach(() => {
    d = new RegulatoryChangeDetectorV3()
  })

  it('registerSnapshot — 감사 로그 기록', () => {
    d.registerSnapshot('v1', { 'c1': '원문' })
    const log = d.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('snapshot.register')
  })

  it('diff — added/removed/modified 탐지', () => {
    d.registerSnapshot('v1', { c1: 'A', c2: 'B', c3: 'C' })
    d.registerSnapshot('v2', { c1: 'A', c2: 'B_new', c4: 'D' })
    const r = d.diff('v1', 'v2')
    expect(r.added).toEqual(['c4'])
    expect(r.removed).toEqual(['c3'])
    expect(r.modified).toEqual(['c2'])
  })

  it('diff — HIGH 영향도 (수정 5개 초과)', () => {
    const base: Record<string, string> = {}
    const next: Record<string, string> = {}
    for (let i = 0; i < 10; i++) {
      base[`c${i}`] = `old${i}`
      next[`c${i}`] = `new${i}`
    }
    d.registerSnapshot('v1', base)
    d.registerSnapshot('v2', next)
    const r = d.diff('v1', 'v2')
    expect(r.impact).toBe('HIGH')
  })

  it('diff — 고위험 키워드 "필수" 포함 시 HIGH', () => {
    d.registerSnapshot('v1', { c1: '조건 충족' })
    d.registerSnapshot('v2', { c1: '보고 필수' })
    const r = d.diff('v1', 'v2')
    expect(r.impact).toBe('HIGH')
  })

  it('registerSnapshot — C/S 등급 차단', () => {
    expect(() => d.registerSnapshot('v1', { c1: 'a' }, 'C')).toThrow(/BLOCKED/)
    expect(() => d.registerSnapshot('v1', { c1: 'a' }, 'S')).toThrow(/BLOCKED/)
  })

  it('diff — 변경 없음 → LOW', () => {
    d.registerSnapshot('v1', { c1: 'same' })
    d.registerSnapshot('v2', { c1: 'same' })
    const r = d.diff('v1', 'v2')
    expect(r.impact).toBe('LOW')
    expect(r.added).toHaveLength(0)
    expect(r.removed).toHaveLength(0)
    expect(r.modified).toHaveLength(0)
  })
})
