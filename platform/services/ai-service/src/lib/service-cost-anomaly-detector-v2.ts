// Design Ref: §핵심 알고리즘 — Z-스코어 이상 탐지 + 예산 초과 알림
// Plan SC: FR-R222.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ServiceCostProfile {
  id: string;
  name: string;
  budgetLimit: number;
  expectedDailyCost: number;
}

interface CostRecord {
  serviceId: string;
  amount: number;
  date: string;
  timestamp: string;
}

interface AnomalyResult {
  serviceId: string;
  date: string;
  amount: number;
  zScore: number;
  type: 'zscore' | 'budget_exceeded';
  severity: 'critical' | 'warning';
  message: string;
}

interface CostRecommendation {
  serviceId: string;
  type: 'scale_down' | 'review_usage' | 'set_alert';
  reason: string;
  potentialSavings: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R222.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

function calcMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function calcStddev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export class ServiceCostAnomalyDetectorV2 {
  private profiles = new Map<string, ServiceCostProfile>();
  private costRecords: CostRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R222.1
  registerService(id: string, name: string, budgetLimit: number, expectedDailyCost: number): void {
    if (budgetLimit <= 0 || expectedDailyCost <= 0) {
      throw new Error('budgetLimit과 expectedDailyCost는 양수여야 합니다');
    }
    this.profiles.set(id, { id, name, budgetLimit, expectedDailyCost });
    this.log('REGISTER_SERVICE', { id, name, budgetLimit, expectedDailyCost });
  }

  // Plan SC: FR-R222.2
  recordCost(serviceId: string, amount: number, date: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);

    if (!this.profiles.has(serviceId)) {
      throw new Error(`서비스 미등록: ${serviceId}`);
    }
    if (amount <= 0) {
      throw new Error('amount는 양수여야 합니다');
    }

    this.costRecords.push({ serviceId, amount, date, timestamp: new Date().toISOString() });
    this.log('RECORD_COST', { serviceId, amount, date });
  }

  // Plan SC: FR-R222.3
  detectAnomalies(serviceId: string): AnomalyResult[] {
    const profile = this.profiles.get(serviceId);
    if (!profile) {
      throw new Error(`서비스 미등록: ${serviceId}`);
    }

    const records = this.costRecords.filter(r => r.serviceId === serviceId);
    if (records.length === 0) return [];

    const amounts = records.map(r => r.amount);
    const mean = calcMean(amounts);
    const stddev = calcStddev(amounts, mean);

    const anomalies: AnomalyResult[] = [];

    for (const record of records) {
      const zScore = stddev === 0 ? 0 : Math.abs((record.amount - mean) / stddev);

      if (record.amount > profile.budgetLimit) {
        anomalies.push({
          serviceId,
          date: record.date,
          amount: record.amount,
          zScore: Math.round(zScore * 100) / 100,
          type: 'budget_exceeded',
          severity: 'critical',
          message: `예산 한도 초과: ${record.amount} > ${profile.budgetLimit}`,
        });
      } else if (zScore > 2.0) {
        anomalies.push({
          serviceId,
          date: record.date,
          amount: record.amount,
          zScore: Math.round(zScore * 100) / 100,
          type: 'zscore',
          severity: zScore > 3.0 ? 'critical' : 'warning',
          message: `Z-스코어 이상 탐지: ${Math.round(zScore * 100) / 100} (임계값: 2.0)`,
        });
      }
    }

    this.log('DETECT_ANOMALIES', { serviceId, anomaliesCount: anomalies.length });
    return anomalies;
  }

  // Plan SC: FR-R222.4
  getRecommendations(serviceId: string): CostRecommendation[] {
    const profile = this.profiles.get(serviceId);
    if (!profile) {
      throw new Error(`서비스 미등록: ${serviceId}`);
    }

    const records = this.costRecords.filter(r => r.serviceId === serviceId);
    if (records.length === 0) return [];

    const recommendations: CostRecommendation[] = [];
    const anomalies = this.detectAnomalies(serviceId);
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');

    if (criticalAnomalies.length >= 3) {
      const avgExcess = criticalAnomalies.reduce((s, a) => s + (a.amount - profile.expectedDailyCost), 0) / criticalAnomalies.length;
      recommendations.push({
        serviceId,
        type: 'scale_down',
        reason: `${criticalAnomalies.length}일 연속 심각 이상 — 리소스 스케일다운 권고`,
        potentialSavings: Math.round(avgExcess * 30),
      });
    } else if (anomalies.length > 0) {
      recommendations.push({
        serviceId,
        type: 'review_usage',
        reason: `${anomalies.length}건 비용 이상 탐지 — 사용량 검토 필요`,
        potentialSavings: 0,
      });
    }

    if (anomalies.length === 0) {
      recommendations.push({
        serviceId,
        type: 'set_alert',
        reason: '현재 정상 범위 — 예산 알림 임계값 설정 권고',
        potentialSavings: 0,
      });
    }

    return recommendations;
  }

  // Plan SC: FR-R222.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
