// Design Ref: §핵심 알고리즘 — 이동 평균 + 선형 추세 결합 예측
// Plan SC: FR-R262.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ApiProfile {
  id: string;
  path: string;
  maxCapacity: number;
  warningThresholdPercent: number;
}

interface CallRecord {
  apiId: string;
  count: number;
  hour: string;
}

interface UsageForecast {
  apiId: string;
  forecastHours: number;
  predictedPeak: number;
  avgUsage: number;
  capacityUtilizationPercent: number;
}

interface CapacityAlert {
  apiId: string;
  path: string;
  predictedPeak: number;
  maxCapacity: number;
  utilizationPercent: number;
  severity: 'critical' | 'warning';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R262.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class ApiUsageForecasterAI {
  private apis = new Map<string, ApiProfile>();
  private callRecords: CallRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R262.1
  registerApi(id: string, path: string, maxCapacity: number, warningThresholdPercent: number = 80): void {
    this.apis.set(id, { id, path, maxCapacity, warningThresholdPercent });
    this.log('REGISTER_API', { id, path, maxCapacity, warningThresholdPercent });
  }

  // Plan SC: FR-R262.2
  recordCallCount(apiId: string, count: number, hour: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.apis.has(apiId)) throw new Error(`API 미등록: ${apiId}`);
    this.callRecords.push({ apiId, count, hour });
    this.log('RECORD_CALL_COUNT', { apiId, count, hour });
  }

  // Plan SC: FR-R262.3
  forecastUsage(apiId: string, forecastHours: number): UsageForecast {
    const api = this.apis.get(apiId);
    if (!api) throw new Error(`API 미등록: ${apiId}`);

    const records = this.callRecords
      .filter(r => r.apiId === apiId)
      .sort((a, b) => a.hour.localeCompare(b.hour));

    if (records.length === 0) {
      return { apiId, forecastHours, predictedPeak: 0, avgUsage: 0, capacityUtilizationPercent: 0 };
    }

    const counts = records.map(r => r.count);
    const avgUsage = Math.round(counts.reduce((s, v) => s + v, 0) / counts.length);

    // 선형 추세 계산
    const n = counts.length;
    const xMean = (n - 1) / 2;
    const yMean = avgUsage;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (counts[i]! - yMean);
      den += (i - xMean) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const predictedPeak = Math.max(0, Math.round(avgUsage + slope * forecastHours));
    const capacityUtilizationPercent = Math.round((predictedPeak / api.maxCapacity) * 100);

    this.log('FORECAST_USAGE', { apiId, forecastHours, predictedPeak, avgUsage });
    return { apiId, forecastHours, predictedPeak, avgUsage, capacityUtilizationPercent };
  }

  // Plan SC: FR-R262.4
  getCapacityAlerts(): CapacityAlert[] {
    const alerts: CapacityAlert[] = [];

    for (const api of this.apis.values()) {
      const forecast = this.forecastUsage(api.id, 24);
      const threshold = api.maxCapacity * (api.warningThresholdPercent / 100);
      if (forecast.predictedPeak >= threshold) {
        alerts.push({
          apiId: api.id,
          path: api.path,
          predictedPeak: forecast.predictedPeak,
          maxCapacity: api.maxCapacity,
          utilizationPercent: forecast.capacityUtilizationPercent,
          severity: forecast.capacityUtilizationPercent >= 100 ? 'critical' : 'warning',
        });
      }
    }

    this.log('GET_CAPACITY_ALERTS', { count: alerts.length });
    return alerts;
  }

  // Plan SC: FR-R262.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
