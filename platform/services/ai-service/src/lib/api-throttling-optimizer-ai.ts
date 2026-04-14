// Design Ref: §권고한도 — 사용률>90&&errRate<0.01:×1.5 / <30:×0.7 / >90&&err>=0.01:×0.8 / else 유지
// Plan SC: SC-R544-1, SC-R544-2, SC-R544-3

interface ThrottleInput {
  clientId: string;
  requestsLast1h: number;
  currentLimit: number;
  avgResponseMs: number;
  errorRate: number;
}

type UsageStatus = 'HIGH_USAGE' | 'NORMAL' | 'LOW_USAGE';

interface ThrottleResult {
  clientId: string;
  usageRate: number;
  status: UsageStatus;
  recommendedLimit: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  clientId: string;
  usageRate: number;
  recommendedLimit: number;
}

export class ApiThrottlingOptimizerAI {
  private readonly auditLog: AuditEntry[] = [];

  optimize(input: ThrottleInput): ThrottleResult {
    const { clientId, requestsLast1h, currentLimit, errorRate } = input;

    const usageRate = Math.round((requestsLast1h / currentLimit) * 100 * 100) / 100;
    const status = this.classifyStatus(usageRate);
    const recommendedLimit = this.computeRecommendedLimit(usageRate, currentLimit, errorRate);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'THROTTLE_OPTIMIZED',
      clientId,
      usageRate,
      recommendedLimit,
    });

    return { clientId, usageRate, status, recommendedLimit };
  }

  private classifyStatus(usageRate: number): UsageStatus {
    if (usageRate > 90) return 'HIGH_USAGE';
    if (usageRate < 30) return 'LOW_USAGE';
    return 'NORMAL';
  }

  private computeRecommendedLimit(usageRate: number, currentLimit: number, errorRate: number): number {
    if (usageRate > 90 && errorRate < 0.01) return Math.ceil(currentLimit * 1.5);
    if (usageRate > 90 && errorRate >= 0.01) return Math.ceil(currentLimit * 0.8);
    if (usageRate < 30) return Math.ceil(currentLimit * 0.7);
    return currentLimit;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
