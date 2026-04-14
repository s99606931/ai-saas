// Design Ref: §예측 — last*(1+growthRate)^forecastDays, capacity=ceil(forecast*1.3)
// Plan SC: SC-R566-1, SC-R566-2, SC-R566-3

interface ForecastInput {
  apiId: string;
  dailyUsage: number[];
  forecastDays: number;
}

interface ForecastResult {
  apiId: string;
  avgDailyGrowthRate: number;
  forecastedUsage: number;
  recommendedCapacity: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  apiId: string;
  forecastedUsage: number;
  recommendedCapacity: number;
}

export class ApiUsageForecasterV3 {
  private readonly auditLog: AuditEntry[] = [];

  forecast(input: ForecastInput): ForecastResult {
    const { apiId, dailyUsage, forecastDays } = input;

    if (dailyUsage.length < 3) {
      throw new Error('insufficient data: dailyUsage must have at least 3 entries');
    }

    const first = dailyUsage[0]!;
    const last = dailyUsage[dailyUsage.length - 1]!;
    const avgDailyGrowthRate = first !== 0
      ? (last - first) / (dailyUsage.length - 1) / first
      : 0;

    const forecastedUsage = Math.ceil(last * Math.pow(1 + avgDailyGrowthRate, forecastDays));
    const recommendedCapacity = Math.ceil(forecastedUsage * 1.3);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'API_USAGE_FORECASTED',
      apiId,
      forecastedUsage,
      recommendedCapacity,
    });

    return {
      apiId,
      avgDailyGrowthRate: Math.round(avgDailyGrowthRate * 10000) / 10000,
      forecastedUsage,
      recommendedCapacity,
    };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
