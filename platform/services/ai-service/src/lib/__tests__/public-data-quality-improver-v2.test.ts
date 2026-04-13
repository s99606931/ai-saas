// Design Ref: §R392 — AI기반 공공 데이터 품질 자동 개선 v2
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataQualityImproverV2, type DataRecord } from '../public-data-quality-improver-v2'

describe('PublicDataQualityImproverV2', () => {
  let improver: PublicDataQualityImproverV2

  beforeEach(() => {
    improver = new PublicDataQualityImproverV2()
  })

  it('빈 데이터셋: qualityScore 100', () => {
    improver.loadDataset('ds-empty', [])
    const report = improver.analyze('ds-empty')
    expect(report.qualityScore).toBe(100)
    expect(report.issueCount).toBe(0)
  })

  it('MISSING_VALUE: null 값 탐지', () => {
    const records: DataRecord[] = [{ recordId: 'r1', datasetId: 'ds-1', fields: { name: null } }]
    improver.loadDataset('ds-1', records)
    const report = improver.analyze('ds-1')
    expect(report.issues.some((i) => i.issueType === 'MISSING_VALUE')).toBe(true)
  })

  it('DUPLICATE: 중복 recordId 탐지', () => {
    const records: DataRecord[] = [
      { recordId: 'r1', datasetId: 'ds-2', fields: { name: '홍길동' } },
      { recordId: 'r1', datasetId: 'ds-2', fields: { name: '홍길동' } },
    ]
    improver.loadDataset('ds-2', records)
    const report = improver.analyze('ds-2')
    expect(report.issues.some((i) => i.issueType === 'DUPLICATE')).toBe(true)
  })

  it('FORMAT_ERROR: 날짜 포맷(2026.04.01) → 자동 수정 제안', () => {
    const records: DataRecord[] = [{ recordId: 'r1', datasetId: 'ds-3', fields: { birthDate: '2026.04.01' } }]
    improver.loadDataset('ds-3', records)
    const report = improver.analyze('ds-3')
    const formatIssue = report.issues.find((i) => i.issueType === 'FORMAT_ERROR')
    expect(formatIssue).toBeDefined()
    expect(formatIssue?.suggestedValue).toBe('2026-04-01')
    expect(report.autoFixedCount).toBe(1)
  })

  it('OUTLIER: age 200 → 이상값 탐지', () => {
    const records: DataRecord[] = [{ recordId: 'r1', datasetId: 'ds-4', fields: { age: 200 } }]
    improver.loadDataset('ds-4', records)
    const report = improver.analyze('ds-4')
    expect(report.issues.some((i) => i.issueType === 'OUTLIER')).toBe(true)
  })

  it('권고사항: 누락값 있으면 필수 필드 정책 권고', () => {
    const records: DataRecord[] = [{ recordId: 'r1', datasetId: 'ds-5', fields: { phone: null } }]
    improver.loadDataset('ds-5', records)
    const report = improver.analyze('ds-5')
    expect(report.recommendations.some((r) => r.includes('누락 값'))).toBe(true)
  })

  it('감사 로그에 analyze 기록', () => {
    improver.loadDataset('ds-6', [])
    improver.analyze('ds-6')
    const logs = improver.getAuditLog()
    expect(logs.some((l) => l.action === 'quality.analyze')).toBe(true)
  })
})
