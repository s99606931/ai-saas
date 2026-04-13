import { describe, it, expect, beforeEach } from 'vitest';
import { DataGovernanceDashboardAI } from '../data-governance-dashboard-ai';

describe('DataGovernanceDashboardAI', () => {
  let dashboard: DataGovernanceDashboardAI;

  beforeEach(() => {
    dashboard = new DataGovernanceDashboardAI();
  });

  it('데이터 자산을 등록한다', () => {
    dashboard.registerAsset('da-1', '주민등록 DB', 'database', '행안부', 'C');
    expect(dashboard.getAuditLog().some(l => l.action === 'REGISTER_ASSET')).toBe(true);
  });

  it('거버넌스 지표를 갱신한다', () => {
    dashboard.registerAsset('da-1', '주민등록 DB', 'database', '행안부', 'C');
    dashboard.updateMetrics('da-1', 90, 95, 85);
    expect(dashboard.getAuditLog().some(l => l.action === 'UPDATE_METRICS')).toBe(true);
  });

  it('거버넌스 점수를 계산한다', () => {
    dashboard.registerAsset('da-1', 'DB', 'database', '행안부', 'C');
    dashboard.updateMetrics('da-1', 100, 100, 100);
    const score = dashboard.calculateGovernanceScore('da-1');
    expect(score.governanceScore).toBe(100);
  });

  it('지표 없으면 score=0이다', () => {
    dashboard.registerAsset('da-1', 'DB', 'database', '행안부', 'C');
    const score = dashboard.calculateGovernanceScore('da-1');
    expect(score.governanceScore).toBe(0);
  });

  it('대시보드 요약을 반환한다', () => {
    dashboard.registerAsset('da-1', 'A', 'db', 'owner', 'O');
    dashboard.registerAsset('da-2', 'B', 'db', 'owner', 'O');
    dashboard.updateMetrics('da-1', 90, 90, 90);
    dashboard.updateMetrics('da-2', 50, 50, 50);
    const summary = dashboard.getDashboardSummary(1);
    expect(summary.totalAssets).toBe(2);
    expect(summary.topAssets[0]!.assetId).toBe('da-1');
    expect(summary.averageScore).toBeGreaterThan(0);
  });

  it('C등급 지표 갱신을 차단한다', () => {
    dashboard.registerAsset('da-1', 'DB', 'database', '행안부', 'C');
    expect(() => dashboard.updateMetrics('da-1', 90, 90, 90, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 자산 지표 갱신 시 오류를 던진다', () => {
    expect(() => dashboard.updateMetrics('unknown', 90, 90, 90)).toThrow('자산 미등록');
  });
});
