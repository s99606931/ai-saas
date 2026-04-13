// Design Ref: §핵심 알고리즘 — 다중 지표 가중 합산 만족도 점수
// Plan SC: FR-R260.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ServiceWeights {
  responseTime: number;
  errorRate: number;
  availability: number;
}

interface ServiceProfile {
  id: string;
  name: string;
  targetScore: number;
  weights: ServiceWeights;
}

interface MetricRecord {
  serviceId: string;
  responseTimeMs: number;
  errorRatePercent: number;
  availabilityPercent: number;
  timestamp: string;
}

interface SatisfactionScore {
  serviceId: string;
  score: number;
  targetScore: number;
  status: 'above_target' | 'at_risk' | 'below_target';
}

interface TrendPrediction {
  serviceId: string;
  trend: 'improving' | 'stable' | 'declining';
  predictedScore: number;
  recommendations: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R260.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class ServiceSatisfactionPredictor {
  private services = new Map<string, ServiceProfile>();
  private metrics: MetricRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R260.1
  registerService(id: string, name: string, targetScore: number, weights: ServiceWeights): void {
    this.services.set(id, { id, name, targetScore, weights });
    this.log('REGISTER_SERVICE', { id, name, targetScore });
  }

  // Plan SC: FR-R260.2
  recordMetrics(serviceId: string, responseTimeMs: number, errorRatePercent: number, availabilityPercent: number, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.services.has(serviceId)) throw new Error(`서비스 미등록: ${serviceId}`);
    this.metrics.push({ serviceId, responseTimeMs, errorRatePercent, availabilityPercent, timestamp: new Date().toISOString() });
    this.log('RECORD_METRICS', { serviceId, responseTimeMs, errorRatePercent, availabilityPercent });
  }

  private computeScore(profile: ServiceProfile, responseTimeMs: number, errorRatePercent: number, availabilityPercent: number): number {
    const rtScore = Math.max(0, 100 - responseTimeMs / 10);
    const errScore = Math.max(0, 100 - errorRatePercent);
    const avScore = availabilityPercent;

    const totalWeight = profile.weights.responseTime + profile.weights.errorRate + profile.weights.availability;
    if (totalWeight === 0) return 0;

    const weighted = (rtScore * profile.weights.responseTime + errScore * profile.weights.errorRate + avScore * profile.weights.availability) / totalWeight;
    return Math.round(weighted * 10) / 10;
  }

  // Plan SC: FR-R260.3
  calculateScore(serviceId: string): SatisfactionScore {
    const profile = this.services.get(serviceId);
    if (!profile) throw new Error(`서비스 미등록: ${serviceId}`);

    const serviceMetrics = this.metrics.filter(m => m.serviceId === serviceId);
    if (serviceMetrics.length === 0) {
      return { serviceId, score: 0, targetScore: profile.targetScore, status: 'below_target' };
    }

    const latest = serviceMetrics[serviceMetrics.length - 1]!;
    const score = this.computeScore(profile, latest.responseTimeMs, latest.errorRatePercent, latest.availabilityPercent);
    const status = score >= profile.targetScore ? 'above_target' : score >= profile.targetScore * 0.9 ? 'at_risk' : 'below_target';

    return { serviceId, score, targetScore: profile.targetScore, status };
  }

  // Plan SC: FR-R260.4
  predictTrend(serviceId: string): TrendPrediction {
    const profile = this.services.get(serviceId);
    if (!profile) throw new Error(`서비스 미등록: ${serviceId}`);

    const serviceMetrics = this.metrics.filter(m => m.serviceId === serviceId);
    if (serviceMetrics.length < 2) {
      return { serviceId, trend: 'stable', predictedScore: 0, recommendations: ['데이터 부족 — 더 많은 지표 수집 필요'] };
    }

    const scores = serviceMetrics.map(m => this.computeScore(profile, m.responseTimeMs, m.errorRatePercent, m.availabilityPercent));
    const recentScores = scores.slice(-3);
    const avg = recentScores.reduce((s, v) => s + v, 0) / recentScores.length;
    const trend = recentScores[recentScores.length - 1]! > recentScores[0]! + 2 ? 'improving'
      : recentScores[recentScores.length - 1]! < recentScores[0]! - 2 ? 'declining' : 'stable';

    const recommendations: string[] = [];
    const latest = serviceMetrics[serviceMetrics.length - 1]!;
    if (latest.responseTimeMs > 500) recommendations.push('응답시간 개선 필요 (현재 > 500ms)');
    if (latest.errorRatePercent > 1) recommendations.push('오류율 감소 필요 (현재 > 1%)');
    if (latest.availabilityPercent < 99) recommendations.push('가용성 향상 필요 (현재 < 99%)');

    this.log('PREDICT_TREND', { serviceId, trend, predictedScore: Math.round(avg) });
    return { serviceId, trend, predictedScore: Math.round(avg), recommendations };
  }

  // Plan SC: FR-R260.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
