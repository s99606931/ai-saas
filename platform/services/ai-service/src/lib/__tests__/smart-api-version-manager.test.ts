import { describe, it, expect, beforeEach } from 'vitest'
import { SmartApiVersionManager } from '../smart-api-version-manager'

describe('SmartApiVersionManager', () => {
  let ai: SmartApiVersionManager

  beforeEach(() => {
    ai = new SmartApiVersionManager()
    ai.registerVersion('v1', 'payment-api', '1.0.0', 'active')
    ai.registerVersion('v2', 'payment-api', '1.2.0', 'active')
    ai.registerVersion('v3', 'payment-api', '2.0.0', 'active')
  })

  it('버전 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'version.register')).toBe(true)
  })

  it('major 버전 차이 — incompatible (breaking change)', () => {
    const result = ai.analyzeCompatibility('v1', 'v3')
    expect(result.compatibility).toBe('incompatible')
    expect(result.breaking).toBe(true)
    expect(result.warning).toBeDefined()
  })

  it('minor 버전 차이 — backward-compatible', () => {
    const result = ai.analyzeCompatibility('v1', 'v2')
    expect(result.compatibility).toBe('backward-compatible')
    expect(result.breaking).toBe(false)
  })

  it('patch 버전 차이 — patch-compatible', () => {
    ai.registerVersion('v1p', 'payment-api', '1.0.1', 'active')
    const result = ai.analyzeCompatibility('v1', 'v1p')
    expect(result.compatibility).toBe('patch-compatible')
  })

  it('업그레이드 경로 — active 버전 중 상위 버전만 추천', () => {
    const paths = ai.getUpgradePath('v1')
    expect(paths.length).toBe(2)
    expect(paths.map((p) => p.toVersion)).toContain('1.2.0')
    expect(paths.map((p) => p.toVersion)).toContain('2.0.0')
  })

  it('deprecated 버전은 업그레이드 경로에서 제외', () => {
    ai.registerVersion('v2dep', 'payment-api', '1.3.0', 'deprecated')
    const paths = ai.getUpgradePath('v1')
    expect(paths.map((p) => p.toVersion)).not.toContain('1.3.0')
  })

  it('C등급 사용량 데이터 차단', () => {
    expect(() => ai.recordUsage('v1', 100, 'C')).toThrow('BLOCKED')
  })

  it('잘못된 semver 형식 에러', () => {
    expect(() => ai.registerVersion('bad', 'api', '1.0', 'active')).toThrow()
  })
})
