import { describe, it, expect, beforeEach } from 'vitest'
import { DataGovernanceDashboardV2 } from '../data-governance-dashboard-v2'

describe('DataGovernanceDashboardV2', () => {
  let dashboard: DataGovernanceDashboardV2

  beforeEach(() => {
    dashboard = new DataGovernanceDashboardV2()
  })

  it('자산 등록 후 조회 가능', () => {
    const asset = dashboard.registerAsset('asset-1', '민원DB', '행정안전부', 'O')
    expect(asset.assetId).toBe('asset-1')
    expect(asset.dataGrade).toBe('O')
  })

  it('이슈 기록 후 이슈 수 조회', () => {
    dashboard.registerAsset('asset-1', '민원DB', '행정안전부', 'O')
    dashboard.recordIssue('asset-1', '접근권한', 'high')
    dashboard.recordIssue('asset-1', '암호화', 'medium')
    expect(dashboard.getIssueCount('asset-1')).toBe(2)
  })

  it('이슈 없으면 이슈 수 0', () => {
    dashboard.registerAsset('asset-1', '민원DB', '행정안전부', 'O')
    expect(dashboard.getIssueCount('asset-1')).toBe(0)
  })

  it('getHighRiskAssets: high 이슈 있는 자산만', () => {
    dashboard.registerAsset('asset-1', '민원DB', '행정안전부', 'O')
    dashboard.registerAsset('asset-2', '통계DB', '통계청', 'O')
    dashboard.recordIssue('asset-1', '접근권한', 'high')
    dashboard.recordIssue('asset-2', '경미이슈', 'low')
    const high = dashboard.getHighRiskAssets()
    expect(high.map((a) => a.assetId)).toContain('asset-1')
    expect(high.map((a) => a.assetId)).not.toContain('asset-2')
  })

  it('C등급 데이터 전송 차단', () => {
    dashboard.registerAsset('asset-1', '민원DB', '행정안전부', 'O')
    expect(() => dashboard.recordIssue('asset-1', '접근권한', 'high', 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    dashboard.registerAsset('asset-1', '민원DB', '행정안전부', 'O')
    expect(() => dashboard.recordIssue('asset-1', '접근권한', 'high', 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    dashboard.registerAsset('asset-1', '민원DB', '행정안전부', 'O')
    dashboard.recordIssue('asset-1', '접근권한', 'high')
    const log = dashboard.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
