// 공공기관 성과 평가 AI -- FR-N314.1~FR-N314.4
// Design Ref: MTU-N314 | CSAP: D-06, D-08, D-12

export interface PerformanceMetric { readonly metricId: string; readonly name: string; readonly target: number; readonly actual: number; readonly weight: number; readonly unit: string; }
export interface EvaluationResult { readonly evaluationId: string; readonly tenantId: string; readonly period: string; readonly metrics: PerformanceMetric[]; readonly overallScore: number; readonly grade: 'S' | 'A' | 'B' | 'C' | 'D'; readonly strengths: string[]; readonly improvements: string[]; readonly generatedAt: string; }
export interface PerfAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: PerfAuditEntry[] = [];
function recordAudit(entry: Omit<PerfAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getPerfAuditLog(tenantId: string): readonly PerfAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

export function calculateMetricScore(metric: PerformanceMetric): number {
  if (metric.target === 0) return 0;
  const ratio = metric.actual / metric.target;
  return Math.min(100, ratio * 100);
}

export function evaluatePerformance(tenantId: string, period: string, metrics: PerformanceMetric[]): EvaluationResult {
  const totalWeight = metrics.reduce((s, m) => s + m.weight, 0);
  const weightedScore = totalWeight > 0
    ? metrics.reduce((s, m) => s + calculateMetricScore(m) * (m.weight / totalWeight), 0)
    : 0;
  let grade: EvaluationResult['grade'] = 'D';
  if (weightedScore >= 95) grade = 'S';
  else if (weightedScore >= 85) grade = 'A';
  else if (weightedScore >= 70) grade = 'B';
  else if (weightedScore >= 50) grade = 'C';

  const strengths = metrics.filter(m => calculateMetricScore(m) >= 90).map(m => `${m.name}: 목표 대비 ${(m.actual / m.target * 100).toFixed(0)}% 달성`);
  const improvements = metrics.filter(m => calculateMetricScore(m) < 70).map(m => `${m.name}: 개선 필요 (${(m.actual / m.target * 100).toFixed(0)}%)`);

  recordAudit({ actor: 'system', tenantId, action: 'PERFORMANCE_EVALUATED', target: tenantId, details: { period, score: weightedScore, grade } });
  return { evaluationId: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, period, metrics, overallScore: weightedScore, grade, strengths, improvements, generatedAt: new Date().toISOString() };
}

export class PerformanceEvaluatorService {
  constructor(private readonly tenantId: string) {}
  evaluate(period: string, metrics: PerformanceMetric[]): EvaluationResult { return evaluatePerformance(this.tenantId, period, metrics); }
  getAuditLog(): readonly PerfAuditEntry[] { return getPerfAuditLog(this.tenantId); }
}
