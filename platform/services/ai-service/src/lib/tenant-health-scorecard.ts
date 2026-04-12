// Design Ref: MTU-N419 §테넌트 건강 스코어카드
// Plan SC: FR-N419.1~5

export interface TenantMetrics {
  tenantId: string;
  dau: number;
  wau: number;
  mau: number;
  totalUsers: number;
  adoptedFeatures: number;
  totalFeatures: number;
  csat: number;
  nps: number;
  paymentFailures: number;
  overdueDays: number;
}

export interface HealthBreakdown {
  usage: number;
  engagement: number;
  satisfaction: number;
  financial: number;
}

export interface HealthScore {
  tenantId: string;
  breakdown: HealthBreakdown;
  total: number;
  status: 'healthy' | 'at-risk' | 'critical';
  alerts: string[];
}

export class TenantHealthScorecard {
  /** FR-N419.1 사용성 */
  scoreUsage(m: TenantMetrics): number {
    if (m.totalUsers <= 0) return 0;
    const dauRatio = m.dau / m.totalUsers;
    const wauRatio = m.wau / m.totalUsers;
    return +Math.min(1, dauRatio * 0.6 + wauRatio * 0.4).toFixed(3);
  }

  /** FR-N419.2 참여도 */
  scoreEngagement(m: TenantMetrics): number {
    if (m.totalFeatures <= 0) return 0;
    return +Math.min(1, m.adoptedFeatures / m.totalFeatures).toFixed(3);
  }

  /** FR-N419.3 만족도 */
  scoreSatisfaction(m: TenantMetrics): number {
    const csatNorm = Math.max(0, Math.min(1, m.csat / 100));
    const npsNorm = Math.max(0, (m.nps + 100) / 200);
    return +((csatNorm * 0.6 + npsNorm * 0.4)).toFixed(3);
  }

  /** FR-N419.4 재무 */
  scoreFinancial(m: TenantMetrics): number {
    let score = 1;
    if (m.paymentFailures > 0) score -= Math.min(0.5, m.paymentFailures * 0.1);
    if (m.overdueDays > 0) score -= Math.min(0.5, m.overdueDays * 0.02);
    return +Math.max(0, score).toFixed(3);
  }

  /** FR-N419.5 종합 */
  calculate(m: TenantMetrics): HealthScore {
    const breakdown: HealthBreakdown = {
      usage: this.scoreUsage(m),
      engagement: this.scoreEngagement(m),
      satisfaction: this.scoreSatisfaction(m),
      financial: this.scoreFinancial(m),
    };
    const total = +(
      breakdown.usage * 0.3 +
      breakdown.engagement * 0.25 +
      breakdown.satisfaction * 0.25 +
      breakdown.financial * 0.2
    ).toFixed(3);

    let status: HealthScore['status'] = 'healthy';
    if (total < 0.4) status = 'critical';
    else if (total < 0.65) status = 'at-risk';

    const alerts: string[] = [];
    if (breakdown.usage < 0.3) alerts.push('사용자 활성도 저조');
    if (breakdown.engagement < 0.3) alerts.push('기능 채택률 저조');
    if (breakdown.satisfaction < 0.5) alerts.push('고객 만족도 하락');
    if (breakdown.financial < 0.6) alerts.push('결제/연체 이슈');

    return { tenantId: m.tenantId, breakdown, total, status, alerts };
  }

  /** 대량 스코어링 */
  rankAtRisk(metrics: TenantMetrics[]): HealthScore[] {
    return metrics
      .map((m) => this.calculate(m))
      .filter((s) => s.status !== 'healthy')
      .sort((a, b) => a.total - b.total);
  }
}

export const tenantHealthScorecard = new TenantHealthScorecard();
