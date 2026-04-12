/**
 * Unit tests for Semantic Version Control for Prompts — SVC-AI-ADV-R107
 */

import { describe, it, expect } from 'vitest'
import { PromptSemanticVersionControl } from '../prompt-semantic-version-control'

describe('SVC-AI-ADV-R107 PromptSemanticVersionControl', () => {
  it('[FR-R107.1] first commit defaults to 1.0.0', () => {
    const v = new PromptSemanticVersionControl()
    const c = v.commit('greeter', '안녕하세요')
    expect(c.versionString).toBe('1.0.0')
    expect(c.isActive).toBe(true)
  })

  it('[FR-R107.1] bump patch/minor/major', () => {
    const v = new PromptSemanticVersionControl()
    v.commit('p', 'a', 'patch')
    v.commit('p', 'b', 'patch')
    expect(v.getActive('p')!.versionString).toBe('1.0.1')
    v.commit('p', 'c', 'minor')
    expect(v.getActive('p')!.versionString).toBe('1.1.0')
    v.commit('p', 'd', 'major')
    expect(v.getActive('p')!.versionString).toBe('2.0.0')
  })

  it('[FR-R107.1] blocks hardcoded secrets', () => {
    const v = new PromptSemanticVersionControl()
    expect(() =>
      v.commit('p', 'key=sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
    ).toThrow(/BLOCKED/)
    expect(() =>
      v.commit('p', '-----BEGIN RSA PRIVATE KEY-----\nblob'),
    ).toThrow(/BLOCKED/)
  })

  it('[FR-R107.2] getActive returns latest by default', () => {
    const v = new PromptSemanticVersionControl()
    v.commit('p', 'a', 'patch')
    v.commit('p', 'b', 'patch')
    expect(v.getActive('p')!.template).toBe('b')
  })

  it('[FR-R107.2] setActive switches to prior version', () => {
    const v = new PromptSemanticVersionControl()
    v.commit('p', 'a')
    v.commit('p', 'b')
    v.setActive('p', '1.0.0')
    expect(v.getActive('p')!.template).toBe('a')
  })

  it('[FR-R107.3] diff shows -/+ lines', () => {
    const v = new PromptSemanticVersionControl()
    v.commit('p', 'line1\nold\nline3')
    v.commit('p', 'line1\nnew\nline3')
    const d = v.diff('p', '1.0.0', '1.0.1')
    const minus = d.filter((l) => l.type === '-')
    const plus = d.filter((l) => l.type === '+')
    expect(minus.length).toBe(1)
    expect(plus.length).toBe(1)
    expect(minus[0]!.line).toBe('old')
    expect(plus[0]!.line).toBe('new')
  })

  it('[FR-R107.3] diff throws on unknown version', () => {
    const v = new PromptSemanticVersionControl()
    v.commit('p', 'a')
    expect(() => v.diff('p', '1.0.0', '9.9.9')).toThrow(/not found/)
  })

  it('[FR-R107.4] rollback returns to previous active', () => {
    const v = new PromptSemanticVersionControl()
    v.commit('p', 'a')
    v.commit('p', 'b')
    v.commit('p', 'c')
    const back = v.rollback('p')
    expect(back).not.toBeNull()
    expect(back!.template).toBe('b')
    expect(v.getActive('p')!.template).toBe('b')
  })

  it('[FR-R107.4] rollback returns null when only one version', () => {
    const v = new PromptSemanticVersionControl()
    v.commit('p', 'a')
    expect(v.rollback('p')).toBeNull()
  })

  it('[FR-R107.5] history returns all commits', () => {
    const v = new PromptSemanticVersionControl()
    v.commit('p', 'a')
    v.commit('p', 'b', 'minor')
    v.commit('p', 'c', 'major')
    const h = v.history('p')
    expect(h).toHaveLength(3)
    expect(h.map((c) => c.versionString)).toEqual(['1.0.0', '1.1.0', '2.0.0'])
  })

  it('[CSAP D-06] audit log records diff and commit', () => {
    const v = new PromptSemanticVersionControl()
    v.commit('p', 'a')
    v.commit('p', 'b')
    v.diff('p', '1.0.0', '1.0.1')
    const actions = v.getAuditLog().map((l) => l.action)
    expect(actions).toContain('commit')
    expect(actions).toContain('diff')
  })
})
