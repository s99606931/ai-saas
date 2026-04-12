/**
 * Tests — SVC-AI-ADV-R161 Prompt Version Registry
 */

import { describe, it, expect } from 'vitest'
import { PromptVersionRegistry } from '../prompt-version-registry'

function makeRegistry() {
  let t = 1_700_000_000_000
  return new PromptVersionRegistry({
    now: () => {
      t += 1
      return t
    },
  })
}

describe('PromptVersionRegistry', () => {
  it('register 후 listVersions 에 반영', () => {
    const r = makeRegistry()
    r.register('civil-qa', '1.0.0', '민원 답변 템플릿 v1', 'alice')
    const list = r.listVersions('civil-qa')
    expect(list).toHaveLength(1)
    expect(list[0]?.version).toBe('1.0.0')
  })

  it('최초 register 는 자동 활성화', () => {
    const r = makeRegistry()
    r.register('civil-qa', '1.0.0', 'template', 'alice')
    const active = r.getActive('civil-qa')
    expect(active?.version).toBe('1.0.0')
  })

  it('중복 버전 등록은 duplicate_version throw', () => {
    const r = makeRegistry()
    r.register('civil-qa', '1.0.0', 'v1', 'alice')
    expect(() => r.register('civil-qa', '1.0.0', 'v1-dup', 'bob')).toThrow('duplicate_version')
  })

  it('activate 후 getActive 반영', () => {
    const r = makeRegistry()
    r.register('civil-qa', '1.0.0', 'v1', 'alice')
    r.register('civil-qa', '1.1.0', 'v1.1', 'bob')
    r.activate('civil-qa', '1.1.0')
    expect(r.getActive('civil-qa')?.version).toBe('1.1.0')
  })

  it('존재하지 않는 버전 활성화 → version_not_found', () => {
    const r = makeRegistry()
    r.register('civil-qa', '1.0.0', 'v1', 'alice')
    expect(() => r.activate('civil-qa', '9.9.9')).toThrow('version_not_found')
  })

  it('rollback 은 직전 active 로 복귀', () => {
    const r = makeRegistry()
    r.register('civil-qa', '1.0.0', 'v1', 'alice')
    r.register('civil-qa', '1.1.0', 'v1.1', 'bob')
    r.activate('civil-qa', '1.1.0')
    const target = r.rollback('civil-qa')
    expect(target).toBe('1.0.0')
    expect(r.getActive('civil-qa')?.version).toBe('1.0.0')
  })

  it('rollback 이력 없음 → no_previous_active', () => {
    const r = makeRegistry()
    r.register('civil-qa', '1.0.0', 'v1', 'alice')
    expect(() => r.rollback('civil-qa')).toThrow('no_previous_active')
  })

  it('C/S 등급 차단', () => {
    const r = makeRegistry()
    expect(() => r.register('x', '1.0.0', 'v', 'a', 'C')).toThrow('grade_blocked')
    expect(() => r.register('x', '1.0.0', 'v', 'a', 'S')).toThrow('grade_blocked')
  })

  it('감사 로그가 모든 변경을 기록', () => {
    const r = makeRegistry()
    r.register('civil-qa', '1.0.0', 'v1', 'alice')
    r.register('civil-qa', '1.1.0', 'v1.1', 'bob')
    r.activate('civil-qa', '1.1.0')
    r.rollback('civil-qa')
    const events = r.getAuditLog().map((l) => l.event)
    expect(events).toContain('registered')
    expect(events).toContain('activated')
    expect(events).toContain('rolledback')
  })

  it('invalid input 거부', () => {
    const r = makeRegistry()
    expect(() => r.register('', '1.0.0', 'v', 'a')).toThrow('invalid_input')
    expect(() => r.register('x', '', 'v', 'a')).toThrow('invalid_input')
  })

  it('존재하지 않는 이름 조회 → null', () => {
    const r = makeRegistry()
    expect(r.getActive('nonexistent')).toBeNull()
  })
})
