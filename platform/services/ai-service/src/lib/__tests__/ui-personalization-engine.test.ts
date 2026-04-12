import { describe, it, expect, beforeEach } from 'vitest'
import { UiPersonalizationEngine } from '../ui-personalization-engine'

describe('UiPersonalizationEngine', () => {
  let engine: UiPersonalizationEngine

  beforeEach(() => {
    engine = new UiPersonalizationEngine()
    engine.registerUser({ userId: 'U-1', department: '정보화팀', role: 'ADMIN', preferredLanguage: 'ko', accessibilityNeeds: ['high_contrast'] })
    engine.registerUser({ userId: 'U-2', department: '민원팀', role: 'VIEWER', preferredLanguage: 'ko', accessibilityNeeds: ['large_font'] })
  })

  it('알 수 없는 사용자 개인화 시 오류', () => {
    expect(() => engine.personalize('UNKNOWN')).toThrow('Unknown user')
  })

  it('접근성 — high_contrast 적용', () => {
    const config = engine.personalize('U-1')
    expect(config.highContrastMode).toBe(true)
  })

  it('접근성 — large_font 적용', () => {
    const config = engine.personalize('U-2')
    expect(config.fontSize).toBe('LARGE')
  })

  it('ADMIN 역할 — COMPACT 레이아웃', () => {
    const config = engine.personalize('U-1')
    expect(config.layoutPreference).toBe('COMPACT')
  })

  it('VIEWER 역할 — SPACIOUS 레이아웃', () => {
    const config = engine.personalize('U-2')
    expect(config.layoutPreference).toBe('SPACIOUS')
  })

  it('사용 이력 기반 topModules 생성', () => {
    engine.recordUsage({ userId: 'U-1', feature: 'audit-logs', durationMs: 5000, timestamp: '2026-04-12T10:00:00Z' })
    engine.recordUsage({ userId: 'U-1', feature: 'audit-logs', durationMs: 3000, timestamp: '2026-04-12T11:00:00Z' })
    engine.recordUsage({ userId: 'U-1', feature: 'reports', durationMs: 2000, timestamp: '2026-04-12T12:00:00Z' })
    const config = engine.personalize('U-1')
    expect(config.topModules).toContain('audit-logs')
  })

  it('알 수 없는 사용자 사용 이력 기록 시 오류', () => {
    expect(() => engine.recordUsage({ userId: 'UNKNOWN', feature: 'dashboard', durationMs: 1000, timestamp: '2026-04-12T10:00:00Z' })).toThrow('Unknown user')
  })

  it('감사 로그 복사본 반환', () => {
    engine.personalize('U-1')
    const log = engine.getAuditLog()
    log.push({ timestamp: '', action: 'injected', userId: 'X', detail: {} })
    expect(engine.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
