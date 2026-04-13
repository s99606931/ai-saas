// Design Ref: §핵심 알고리즘 — 선형 회귀 비용 예측 + 예산 경고
// Plan SC: FR-R259.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ResourceProfile {
  id: string;
  name: string;
  unitCost: number;
  monthlyBudget: number;
}

interface UsageRecord {
  resourceId: string;
  amount: number;
  date: string;
}

interface ForecastResult {
  resourceId: string;
  forecastDays: number;
  predictedUsage: number;
  predictedCost: number;
  confidence: 'high' | 'medium' | 'low';
}

interface BudgetAlert {
  resourceId: string;
  resourceName: string;
  predictedMonthlyCost: number;
  monthlyBudget: number;
  overagePercent: number;
  severity: 'critical' | 'warning';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R259.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i]! - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

export class InfraCostForecasterAI {
  private resources = new Map<string, ResourceProfile>();
  private usageRecords: UsageRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R259.1
  registerResource(id: string, name: string, unitCost: number, monthlyBudget: number): void {
    this.resources.set(id, { id, name, unitCost, monthlyBudget });
    this.log('REGISTER_RESOURCE', { id, name, unitCost, monthlyBudget });
  }

  // Plan SC: FR-R259.2
  recordUsage(resourceId: string, amount: number, date: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.resources.has(resourceId)) throw new Error(`리소스 미등록: ${resourceId}`);
    if (amount < 0) throw new Error('amount는 0 이상이어야 합니다');
    this.usageRecords.push({ resourceId, amount, date });
    this.log('RECORD_USAGE', { resourceId, amount, date });
  }

  // Plan SC: FR-R259.3
  forecast(resourceId: string, forecastDays: number): ForecastResult {
    const resource = this.resources.get(resourceId);
    if (!resource) throw new Error(`리소스 미등록: ${resourceId}`);

    const records = this.usageRecords
      .filter(r => r.resourceId === resourceId)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (records.length === 0) {
      return { resourceId, forecastDays, predictedUsage: 0, predictedCost: 0, confidence: 'low' };
    }

    const values = records.map(r => r.amount);
    const { slope, intercept } = linearRegression(values);
    const predictedUsage = Math.max(0, Math.round(intercept + slope * (values.length + forecastDays)));
    const predictedCost = Math.round(predictedUsage * resource.unitCost);
    const confidence: 'high' | 'medium' | 'low' = values.length >= 14 ? 'high' : values.length >= 7 ? 'medium' : 'low';

    this.log('FORECAST', { resourceId, forecastDays, predictedUsage, predictedCost });
    return { resourceId, forecastDays, predictedUsage, predictedCost, confidence };
  }

  // Plan SC: FR-R259.4
  getBudgetAlerts(): BudgetAlert[] {
    const alerts: BudgetAlert[] = [];

    for (const resource of this.resources.values()) {
      const result = this.forecast(resource.id, 30);
      if (result.predictedCost > resource.monthlyBudget) {
        const overagePercent = Math.round(((result.predictedCost - resource.monthlyBudget) / resource.monthlyBudget) * 100);
        alerts.push({
          resourceId: resource.id,
          resourceName: resource.name,
          predictedMonthlyCost: result.predictedCost,
          monthlyBudget: resource.monthlyBudget,
          overagePercent,
          severity: overagePercent >= 20 ? 'critical' : 'warning',
        });
      }
    }

    this.log('GET_BUDGET_ALERTS', { count: alerts.length });
    return alerts;
  }

  // Plan SC: FR-R259.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
