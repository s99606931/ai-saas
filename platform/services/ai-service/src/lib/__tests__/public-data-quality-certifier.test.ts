/**
 * Unit tests for Public Data Quality Certifier — SVC-AI-ADV-R140
 */
import { describe, it, expect } from 'vitest'
import { PublicDataQualityCertifier, DataGrade } from '../public-data-quality-certifier'

const makeProfile = (overrides = {}) => ({
  id: 'ds-001',
  name: '도로교통 공개데이터',
  totalRows: 100000,
  grade: DataGrade.O,
  dimensions: { completeness: 98, accuracy: 97, consistency: 95, timeliness: 90, uniqueness: 99 },
  lastUpdatedDays: 30,
  ...overrides,
})

describe('SVC-AI-ADV-R140 PublicDataQualityCertifier', () => {
  it('[FR-R140.1] registers dataset', () => {
    const certifier = new PublicDataQualityCertifier()
    certifier.registerDataset(makeProfile())
    const result = certifier.certify('ds-001')
    expect(result.datasetId).toBe('ds-001')
  })

  it('[FR-R140.1] blocks C/S grade datasets', () => {
    const certifier = new PublicDataQualityCertifier()
    expect(() => certifier.registerDataset(makeProfile({ grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => certifier.registerDataset(makeProfile({ grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R140.5] high-quality dataset earns GOLD', () => {
    const certifier = new PublicDataQualityCertifier()
    certifier.registerDataset(makeProfile())
    const result = certifier.certify('ds-001')
    expect(result.certGrade).toBe('GOLD')
  })

  it('[FR-R140.5] low-quality dataset earns FAIL', () => {
    const certifier = new PublicDataQualityCertifier()
    certifier.registerDataset(makeProfile({
      dimensions: { completeness: 60, accuracy: 60, consistency: 60, timeliness: 50, uniqueness: 60 },
    }))
    const result = certifier.certify('ds-001')
    expect(result.certGrade).toBe('FAIL')
  })

  it('[FR-R140.3] stale dataset (>365 days) fails timeliness', () => {
    const certifier = new PublicDataQualityCertifier()
    certifier.registerDataset(makeProfile({ lastUpdatedDays: 400 }))
    const result = certifier.certify('ds-001')
    const timeliness = result.checks.find(c => c.dimension === 'timeliness')
    expect(timeliness?.passed).toBe(false)
  })

  it('[FR-R140.6] certify includes validUntil 1 year from now', () => {
    const certifier = new PublicDataQualityCertifier()
    certifier.registerDataset(makeProfile())
    const now = new Date('2026-04-12')
    const result = certifier.certify('ds-001', now)
    expect(result.validUntil).toContain('2027')
  })

  it('throws on unknown dataset', () => {
    const certifier = new PublicDataQualityCertifier()
    expect(() => certifier.certify('unknown')).toThrow('not registered')
  })

  it('audit log records certify', () => {
    const certifier = new PublicDataQualityCertifier()
    certifier.registerDataset(makeProfile())
    certifier.certify('ds-001')
    expect(certifier.getAuditLog().some(e => e.action === 'certify')).toBe(true)
  })
})
