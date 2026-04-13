import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataLifecycleManagerAi, type PublicDataset } from '../public-data-lifecycle-manager-ai'

describe('PublicDataLifecycleManagerAi', () => {
  let manager: PublicDataLifecycleManagerAi

  const activeDataset: PublicDataset = {
    datasetId: 'DS001',
    name: '민원 처리 현황',
    dataGrade: 'O',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), // 30일 전
    lastAccessedAt: new Date(Date.now() - 5 * 86400000).toISOString(), // 5일 전
    retentionPolicyDays: 365,
    sizeGb: 10,
    accessCountLast90Days: 50,
    legalHold: false,
  }

  beforeEach(() => {
    manager = new PublicDataLifecycleManagerAi()
    manager.registerDataset(activeDataset)
  })

  it('데이터셋 등록 감사 로그', () => {
    const log = manager.getAuditLog()
    expect(log.some((e) => e.action === 'dataset.register')).toBe(true)
  })

  it('최근 접근 → ACTIVE, RETAIN', () => {
    const decision = manager.evaluate('DS001')
    expect(decision.currentStage).toBe('ACTIVE')
    expect(decision.recommendedAction).toBe('RETAIN')
  })

  it('90일 이상 미접근 → ARCHIVAL', () => {
    manager.registerDataset({
      ...activeDataset,
      datasetId: 'DS002',
      lastAccessedAt: new Date(Date.now() - 100 * 86400000).toISOString(),
      accessCountLast90Days: 0,
    })
    const decision = manager.evaluate('DS002')
    expect(decision.currentStage).toBe('ARCHIVAL')
    expect(decision.recommendedAction).toBe('ARCHIVE')
  })

  it('보존 기간 초과 → DELETION_PENDING', () => {
    manager.registerDataset({
      ...activeDataset,
      datasetId: 'DS003',
      createdAt: new Date(Date.now() - 400 * 86400000).toISOString(),
      lastAccessedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      retentionPolicyDays: 365,
    })
    const decision = manager.evaluate('DS003')
    expect(decision.currentStage).toBe('DELETION_PENDING')
    expect(decision.recommendedAction).toBe('DELETE')
  })

  it('legalHold → LEGAL_HOLD, 삭제 불가', () => {
    manager.registerDataset({ ...activeDataset, datasetId: 'DS004', legalHold: true })
    const decision = manager.evaluate('DS004')
    expect(decision.recommendedAction).toBe('LEGAL_HOLD')
    expect(decision.recommendations.some((r) => r.includes('법적 보존'))).toBe(true)
  })

  it('C등급 → 보안 삭제 권고', () => {
    manager.registerDataset({
      ...activeDataset,
      datasetId: 'DS005',
      dataGrade: 'C',
      createdAt: new Date(Date.now() - 400 * 86400000).toISOString(),
      retentionPolicyDays: 365,
    })
    const decision = manager.evaluate('DS005')
    expect(decision.recommendations.some((r) => r.includes('보안 삭제') || r.includes('Secure'))).toBe(true)
  })

  it('미등록 데이터셋 에러', () => {
    expect(() => manager.evaluate('UNKNOWN')).toThrow()
  })

  it('평가 후 감사 로그', () => {
    manager.evaluate('DS001')
    const log = manager.getAuditLog()
    expect(log.some((e) => e.action === 'lifecycle.evaluate')).toBe(true)
  })
})
