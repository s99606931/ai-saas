import { describe, it, expect, beforeEach } from 'vitest'
import { DataGovernanceAutomatorAI } from '../data-governance-automator-ai'

describe('DataGovernanceAutomatorAI', () => {
  let automator: DataGovernanceAutomatorAI

  beforeEach(() => {
    automator = new DataGovernanceAutomatorAI()
    automator.registerAsset({ assetId: 'DA-1', name: '주민 데이터', owner: '행정팀', classification: 'CONFIDENTIAL', retentionPolicy: '5Y', containsPII: true, lastAccessedAt: '2026-04-01T00:00:00Z', createdAt: '2020-01-01T00:00:00Z' })
  })

  it('알 수 없는 자산 평가 시 오류', () => {
    expect(() => automator.assess('UNKNOWN')).toThrow('Unknown asset')
  })

  it('준수 데이터 — COMPLIANT', () => {
    const result = automator.assess('DA-1')
    expect(result.complianceStatus).toBe('COMPLIANT')
    expect(result.violations.length).toBe(0)
  })

  it('PII 포함 PUBLIC 분류 — NON_COMPLIANT', () => {
    automator.registerAsset({ assetId: 'DA-2', name: '공개 개인정보', owner: '홍보팀', classification: 'PUBLIC', retentionPolicy: '1Y', containsPII: true, lastAccessedAt: '2026-04-01T00:00:00Z', createdAt: '2025-01-01T00:00:00Z' })
    const result = automator.assess('DA-2')
    expect(result.complianceStatus).toBe('NON_COMPLIANT')
    expect(result.violations.some((v) => v.includes('개인정보보호법'))).toBe(true)
  })

  it('보존 기간 만료 — NON_COMPLIANT', () => {
    automator.registerAsset({ assetId: 'DA-3', name: '만료 데이터', owner: '기록팀', classification: 'INTERNAL', retentionPolicy: '1Y', containsPII: false, lastAccessedAt: '2020-01-01T00:00:00Z', createdAt: '2020-01-01T00:00:00Z' })
    const result = automator.assess('DA-3')
    expect(result.violations.some((v) => v.includes('만료'))).toBe(true)
  })

  it('장기 미접근 데이터 — 권고 포함', () => {
    automator.registerAsset({ assetId: 'DA-4', name: '미접근 데이터', owner: '팀', classification: 'INTERNAL', retentionPolicy: '10Y', containsPII: false, lastAccessedAt: '2024-01-01T00:00:00Z', createdAt: '2024-01-01T00:00:00Z' })
    const result = automator.assess('DA-4')
    expect(result.recommendations.some((r) => r.includes('미접근'))).toBe(true)
  })

  it('보존 기간 만료일 반환', () => {
    const result = automator.assess('DA-1')
    expect(result.retentionExpiry).toBeDefined()
    expect(result.retentionExpiry).toContain('2025')
  })

  it('감사 로그 복사본 반환', () => {
    automator.assess('DA-1')
    const log = automator.getAuditLog()
    log.push({ timestamp: '', action: 'injected', assetId: 'X', detail: {} })
    expect(automator.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
