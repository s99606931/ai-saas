// Plan SC: SVC-AI-ADV-R437-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataOpennessAutomatorV2, type DataSet } from '../public-data-openness-automator-v2'

describe('PublicDataOpennessAutomatorV2', () => {
  let automator: PublicDataOpennessAutomatorV2

  beforeEach(() => {
    automator = new PublicDataOpennessAutomatorV2()
  })

  const openDataset: DataSet = {
    datasetId: 'DS-1',
    title: '서울시 대기질 통계',
    category: 'ENVIRONMENT',
    grade: 'O',
    fields: [
      { name: 'date', containsPII: false, sensitive: false },
      { name: 'pm10', containsPII: false, sensitive: false },
      { name: 'pm25', containsPII: false, sensitive: false },
    ],
    recordCount: 10000,
    lastUpdated: '2026-04-01',
  }

  it('미등록 데이터셋 평가 시 오류 발생', () => {
    expect(() => automator.evaluate('UNKNOWN')).toThrow('Unknown dataset')
  })

  it('C등급 → REJECTED', () => {
    automator.registerDataset({ ...openDataset, datasetId: 'DS-C', grade: 'C' })
    const decision = automator.evaluate('DS-C')
    expect(decision.status).toBe('REJECTED')
    expect(decision.openScore).toBe(0)
  })

  it('S등급 → REJECTED', () => {
    automator.registerDataset({ ...openDataset, datasetId: 'DS-S', grade: 'S' })
    const decision = automator.evaluate('DS-S')
    expect(decision.status).toBe('REJECTED')
  })

  it('O등급 PII 없음 → APPROVED', () => {
    automator.registerDataset(openDataset)
    const decision = automator.evaluate('DS-1')
    expect(decision.status).toBe('APPROVED')
    expect(decision.redactedFields).toHaveLength(0)
    expect(decision.openScore).toBeGreaterThanOrEqual(70)
  })

  it('PII 필드 포함 → REDACTED_APPROVED + PII 제거', () => {
    automator.registerDataset({
      ...openDataset,
      datasetId: 'DS-PII',
      fields: [
        { name: 'date', containsPII: false, sensitive: false },
        { name: 'name', containsPII: true, sensitive: false },
        { name: 'phone', containsPII: true, sensitive: false },
      ],
    })
    const decision = automator.evaluate('DS-PII')
    expect(decision.status).toBe('REDACTED_APPROVED')
    expect(decision.redactedFields).toContain('name')
    expect(decision.redactedFields).toContain('phone')
  })

  it('openScore 0~100 범위', () => {
    automator.registerDataset(openDataset)
    const decision = automator.evaluate('DS-1')
    expect(decision.openScore).toBeGreaterThanOrEqual(0)
    expect(decision.openScore).toBeLessThanOrEqual(100)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    automator.registerDataset(openDataset)
    automator.evaluate('DS-1')
    const log1 = automator.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', datasetId: 'X', detail: {} })
    const log2 = automator.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
