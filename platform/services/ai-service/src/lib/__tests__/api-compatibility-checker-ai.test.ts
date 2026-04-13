import { describe, it, expect, beforeEach } from 'vitest'
import { ApiCompatibilityCheckerAI } from '../api-compatibility-checker-ai'

describe('ApiCompatibilityCheckerAI', () => {
  let ai: ApiCompatibilityCheckerAI

  beforeEach(() => {
    ai = new ApiCompatibilityCheckerAI()
    ai.registerSchema('v1', 'user-api', '1.0', [
      { name: 'id', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: false },
    ])
    ai.registerSchema('v2', 'user-api', '2.0', [
      { name: 'id', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'phone', type: 'string', required: false },
    ])
  })

  it('스키마 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'schema.register')).toBe(true)
  })

  it('필드 삭제 — breaking change 탐지', () => {
    const report = ai.checkCompatibility('v1', 'v2')
    expect(report.compatible).toBe(false)
    expect(report.breakingChanges.some((c) => c.field === 'email' && c.changeType === 'removed')).toBe(true)
  })

  it('필드 추가 — backward-compatible (minor change)', () => {
    const report = ai.checkCompatibility('v1', 'v2')
    expect(report.minorChanges.some((c) => c.field === 'phone' && c.changeType === 'added')).toBe(true)
  })

  it('타입 변경 — breaking change 탐지', () => {
    ai.registerSchema('v3', 'user-api', '3.0', [
      { name: 'id', type: 'number', required: true },
      { name: 'name', type: 'string', required: true },
    ])
    const report = ai.checkCompatibility('v1', 'v3')
    expect(report.breakingChanges.some((c) => c.changeType === 'type_changed' && c.field === 'id')).toBe(true)
  })

  it('변경 없음 — compatible=true', () => {
    ai.registerSchema('v1copy', 'user-api', '1.0.1', [
      { name: 'id', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: false },
    ])
    const report = ai.checkCompatibility('v1', 'v1copy')
    expect(report.compatible).toBe(true)
    expect(report.breakingChanges.length).toBe(0)
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.checkCompatibility('v1', 'v2', 'C')).toThrow('BLOCKED')
  })

  it('미등록 스키마 에러', () => {
    expect(() => ai.checkCompatibility('unknown', 'v2')).toThrow()
  })
})
