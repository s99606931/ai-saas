import { describe, it, expect, beforeEach } from 'vitest'
import { GovAssetDepreciationAi } from '../gov-asset-depreciation-ai.js'

describe('GovAssetDepreciationAi (FR-R502.1)', () => {
  let svc: GovAssetDepreciationAi

  beforeEach(() => {
    svc = new GovAssetDepreciationAi()
  })

  it('정액법 감가상각 계산', () => {
    svc.registerAsset(
      {
        assetId: 'A1',
        category: '차량',
        acquisitionCost: 10000,
        acquisitionDate: '2020-01-01',
        usefulLifeYears: 10,
        salvageValue: 1000,
        method: 'STRAIGHT_LINE',
      },
      'O'
    )
    const r = svc.computeDepreciation('A1', '2025-01-01')
    expect(r.bookValue).toBeLessThan(10000)
    expect(r.bookValue).toBeGreaterThan(1000)
    expect(r.accumulatedDepreciation).toBeGreaterThan(0)
  })

  it('정률법 감가상각 계산', () => {
    svc.registerAsset(
      {
        assetId: 'A2',
        category: '서버',
        acquisitionCost: 5000,
        acquisitionDate: '2022-01-01',
        usefulLifeYears: 5,
        salvageValue: 500,
        method: 'DECLINING_BALANCE',
      },
      'O'
    )
    const r = svc.computeDepreciation('A2', '2025-01-01')
    expect(r.accumulatedDepreciation).toBeGreaterThan(0)
    expect(r.bookValue).toBeGreaterThanOrEqual(500)
  })

  it('내용연수 만료 시 needsReplacement=true', () => {
    svc.registerAsset(
      {
        assetId: 'A3',
        category: '컴퓨터',
        acquisitionCost: 1000,
        acquisitionDate: '2018-01-01',
        usefulLifeYears: 5,
        salvageValue: 100,
        method: 'STRAIGHT_LINE',
      },
      'O'
    )
    const r = svc.computeDepreciation('A3', '2026-01-01')
    expect(r.needsReplacement).toBe(true)
  })

  it('잔존가치 비정상 시 예외', () => {
    expect(() =>
      svc.registerAsset(
        {
          assetId: 'A4',
          category: '건물',
          acquisitionCost: 1000,
          acquisitionDate: '2020-01-01',
          usefulLifeYears: 30,
          salvageValue: 1500,
          method: 'STRAIGHT_LINE',
        },
        'O'
      )
    ).toThrow(/salvageValue/)
  })

  it('S 등급 데이터 차단', () => {
    expect(() =>
      svc.registerAsset(
        {
          assetId: 'A5',
          category: '비밀',
          acquisitionCost: 100,
          acquisitionDate: '2020-01-01',
          usefulLifeYears: 5,
          salvageValue: 10,
          method: 'STRAIGHT_LINE',
        },
        'S'
      )
    ).toThrow(/BLOCKED/)
  })

  it('감사 로그 확인', () => {
    svc.registerAsset(
      {
        assetId: 'A6',
        category: '장비',
        acquisitionCost: 2000,
        acquisitionDate: '2024-01-01',
        usefulLifeYears: 10,
        salvageValue: 200,
        method: 'STRAIGHT_LINE',
      },
      'O'
    )
    svc.computeDepreciation('A6', '2025-01-01')
    expect(svc.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
