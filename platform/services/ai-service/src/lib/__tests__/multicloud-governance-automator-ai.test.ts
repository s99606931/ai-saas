// Design Ref: §R427 — Public Asset Manager AI
import { describe, it, expect, beforeEach } from 'vitest'
import { MulticloudGovernanceAutomatorAi } from '../multicloud-governance-automator-ai'

describe('MulticloudGovernanceAutomatorAi (Asset Manager)', () => {
  let manager: MulticloudGovernanceAutomatorAi

  beforeEach(() => {
    manager = new MulticloudGovernanceAutomatorAi()
  })

  it('DISPOSE: BAD 상태 → BAD_CONDITION', () => {
    manager.registerAsset({ assetId: 'A001', elapsedYears: 3, usefulLifeYears: 10, condition: 'BAD' })
    const report = manager.evaluate()
    expect(report.advices[0]?.recommendation).toBe('DISPOSE')
    expect(report.advices[0]?.reasonCode).toBe('BAD_CONDITION')
  })

  it('KEEP: ageRatio < 0.7', () => {
    manager.registerAsset({ assetId: 'A002', elapsedYears: 3, usefulLifeYears: 10, condition: 'GOOD' })
    // ageRatio=0.3 < 0.7 → KEEP
    const report = manager.evaluate()
    expect(report.advices[0]?.recommendation).toBe('KEEP')
    expect(report.advices[0]?.reasonCode).toBe('WITHIN_USEFUL_LIFE')
  })

  it('REVIEW: 0.7 ≤ ageRatio < 1.0', () => {
    manager.registerAsset({ assetId: 'A003', elapsedYears: 8, usefulLifeYears: 10, condition: 'FAIR' })
    // ageRatio=0.8 → REVIEW
    const report = manager.evaluate()
    expect(report.advices[0]?.recommendation).toBe('REVIEW')
    expect(report.advices[0]?.reasonCode).toBe('APPROACHING_EOL')
  })

  it('DISPOSE: ageRatio ≥ 1.0 → EOL', () => {
    manager.registerAsset({ assetId: 'A004', elapsedYears: 12, usefulLifeYears: 10, condition: 'FAIR' })
    const report = manager.evaluate()
    expect(report.advices[0]?.recommendation).toBe('DISPOSE')
    expect(report.advices[0]?.reasonCode).toBe('EOL')
  })

  it('disposeCount/reviewCount 집계', () => {
    manager.registerAsset({ assetId: 'A005', elapsedYears: 12, usefulLifeYears: 10, condition: 'GOOD' })
    manager.registerAsset({ assetId: 'A006', elapsedYears: 8, usefulLifeYears: 10, condition: 'FAIR' })
    manager.registerAsset({ assetId: 'A007', elapsedYears: 2, usefulLifeYears: 10, condition: 'GOOD' })
    const report = manager.evaluate()
    expect(report.disposeCount).toBe(1)
    expect(report.reviewCount).toBe(1)
  })

  it('감사 로그에 asset.evaluate 기록', () => {
    manager.registerAsset({ assetId: 'A008', elapsedYears: 5, usefulLifeYears: 10, condition: 'GOOD' })
    manager.evaluate()
    const logs = manager.getAuditLog()
    expect(logs.some((l) => l.action === 'asset.evaluate')).toBe(true)
  })
})
