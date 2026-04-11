// 용량 예측/트렌드 분석 엔진 -- FR-N340.1~FR-N340.4
// Design Ref: MTU-N340 | CSAP: D-06, D-08

export interface CapacityDataPoint { readonly timestamp: string; readonly resourceId: string; readonly metricName: string; readonly value: number; readonly unit: string; }
export interface TrendAnalysis { readonly resourceId: string; readonly metricName: string; readonly slope: number; readonly intercept: number; readonly rSquared: number; readonly trend: 'increasing' | 'decreasing' | 'stable'; }
export interface CapacityForecast { readonly resourceId: string; readonly metricName: string; readonly currentValue: number; readonly forecastedValue: number; readonly capacityLimit: number; readonly daysUntilFull: number | null; readonly alert: boolean; readonly alertMessage: string; }
export interface CapacityAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: CapacityAuditEntry[] = [];
function recordAudit(entry: Omit<CapacityAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getCapacityAuditLog(tenantId: string): readonly CapacityAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const dataStore: Map<string, CapacityDataPoint[]> = new Map();

export function recordDataPoint(tenantId: string, resourceId: string, metricName: string, value: number, unit: string): CapacityDataPoint {
  const point: CapacityDataPoint = { timestamp: new Date().toISOString(), resourceId, metricName, value, unit };
  const key = `${tenantId}:${resourceId}:${metricName}`;
  const existing = dataStore.get(key) ?? [];
  existing.push(point);
  dataStore.set(key, existing);
  return point;
}

export function linearRegression(values: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, rSquared: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i] ?? 0;
    sumX += i; sumY += v; sumXY += i * v; sumX2 += i * i; sumY2 += v * v;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i] ?? 0;
    ssTot += (v - meanY) ** 2;
    ssRes += (v - (slope * i + intercept)) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, rSquared };
}

export function analyzeTrend(tenantId: string, resourceId: string, metricName: string): TrendAnalysis {
  const key = `${tenantId}:${resourceId}:${metricName}`;
  const points = dataStore.get(key) ?? [];
  const values = points.map(p => p.value);
  const { slope, intercept, rSquared } = linearRegression(values);
  let trend: TrendAnalysis['trend'] = 'stable';
  if (slope > 0.01) trend = 'increasing';
  else if (slope < -0.01) trend = 'decreasing';
  return { resourceId, metricName, slope, intercept, rSquared, trend };
}

export function forecastCapacity(tenantId: string, resourceId: string, metricName: string, capacityLimit: number, forecastDays: number = 30): CapacityForecast {
  const key = `${tenantId}:${resourceId}:${metricName}`;
  const points = dataStore.get(key) ?? [];
  const values = points.map(p => p.value);
  const { slope, intercept } = linearRegression(values);
  const currentValue = values.length > 0 ? values[values.length - 1] ?? 0 : 0;
  const forecastedValue = slope * (values.length + forecastDays) + intercept;
  let daysUntilFull: number | null = null;
  if (slope > 0 && currentValue < capacityLimit) {
    daysUntilFull = Math.ceil((capacityLimit - currentValue) / slope);
  }
  const alert = daysUntilFull !== null && daysUntilFull <= forecastDays;
  const alertMessage = alert ? `${resourceId} ${metricName}: ${daysUntilFull}일 후 용량 초과 예상` : '정상 범위';
  recordAudit({ actor: 'system', tenantId, action: 'CAPACITY_FORECAST', target: resourceId, details: { metricName, currentValue, forecastedValue, daysUntilFull, alert } });
  return { resourceId, metricName, currentValue, forecastedValue, capacityLimit, daysUntilFull, alert, alertMessage };
}

export class CapacityForecastEngineService {
  constructor(private readonly tenantId: string) {}
  record(resourceId: string, metric: string, value: number, unit: string): CapacityDataPoint { return recordDataPoint(this.tenantId, resourceId, metric, value, unit); }
  trend(resourceId: string, metric: string): TrendAnalysis { return analyzeTrend(this.tenantId, resourceId, metric); }
  forecast(resourceId: string, metric: string, limit: number, days?: number): CapacityForecast { return forecastCapacity(this.tenantId, resourceId, metric, limit, days); }
  getAuditLog(): readonly CapacityAuditEntry[] { return getCapacityAuditLog(this.tenantId); }
}
