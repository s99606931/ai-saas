// Design Ref: §핵심 알고리즘 — 기준선 비교 + 회귀 탐지 + 트렌드
// Plan SC: FR-R246.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type Trend = 'improving' | 'stable' | 'degrading';

interface BenchmarkScenario {
  id: string;
  name: string;
  metricName: string;
  baselineValue: number;
  regressionThresholdPercent: number;
}

interface BenchmarkRun {
  scenarioId: string;
  runId: string;
  value: number;
  timestamp: string;
}

interface ComparisonResult {
  scenarioId: string;
  baselineValue: number;
  currentAvg: number;
  regressionPercent: number;
  trend: Trend;
  isRegression: boolean;
}

interface RegressionAlert {
  scenarioId: string;
  scenarioName: string;
  regressionPercent: number;
  threshold: number;
  severity: 'critical' | 'warning';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R246.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class RealtimePerformanceBenchmarker {
  private scenarios = new Map<string, BenchmarkScenario>();
  private runs: BenchmarkRun[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R246.1
  registerScenario(id: string, name: string, metricName: string, baselineValue: number, regressionThresholdPercent: number = 10): void {
    this.scenarios.set(id, { id, name, metricName, baselineValue, regressionThresholdPercent });
    this.log('REGISTER_SCENARIO', { id, name, baselineValue, regressionThresholdPercent });
  }

  // Plan SC: FR-R246.2
  recordResult(scenarioId: string, value: number, runId: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.scenarios.has(scenarioId)) throw new Error(`시나리오 미등록: ${scenarioId}`);
    this.runs.push({ scenarioId, runId, value, timestamp: new Date().toISOString() });
    this.log('RECORD_RESULT', { scenarioId, runId, value });
  }

  // Plan SC: FR-R246.3
  compareToBaseline(scenarioId: string): ComparisonResult {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error(`시나리오 미등록: ${scenarioId}`);

    const scenarioRuns = this.runs.filter(r => r.scenarioId === scenarioId);
    if (scenarioRuns.length === 0) {
      return {
        scenarioId,
        baselineValue: scenario.baselineValue,
        currentAvg: 0,
        regressionPercent: 0,
        trend: 'stable',
        isRegression: false,
      };
    }

    const values = scenarioRuns.map(r => r.value);
    const currentAvg = values.reduce((s, v) => s + v, 0) / values.length;
    const regressionPercent = ((currentAvg - scenario.baselineValue) / scenario.baselineValue) * 100;
    const isRegression = regressionPercent > scenario.regressionThresholdPercent;

    // 트렌드: 첫 절반 vs 후반 절반 평균 비교
    const mid = Math.floor(values.length / 2);
    let trend: Trend = 'stable';
    if (values.length >= 4) {
      const firstHalfAvg = values.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
      const secondHalfAvg = values.slice(mid).reduce((s, v) => s + v, 0) / (values.length - mid);
      const trendPercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      if (trendPercent < -5) trend = 'improving';
      else if (trendPercent > 5) trend = 'degrading';
    }

    this.log('COMPARE_TO_BASELINE', { scenarioId, regressionPercent: Math.round(regressionPercent) });
    return { scenarioId, baselineValue: scenario.baselineValue, currentAvg: Math.round(currentAvg), regressionPercent: Math.round(regressionPercent * 100) / 100, trend, isRegression };
  }

  // Plan SC: FR-R246.4
  detectRegressions(): RegressionAlert[] {
    const alerts: RegressionAlert[] = [];

    for (const scenario of this.scenarios.values()) {
      const comparison = this.compareToBaseline(scenario.id);
      if (comparison.isRegression) {
        alerts.push({
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          regressionPercent: comparison.regressionPercent,
          threshold: scenario.regressionThresholdPercent,
          severity: comparison.regressionPercent > scenario.regressionThresholdPercent * 2 ? 'critical' : 'warning',
        });
      }
    }

    this.log('DETECT_REGRESSIONS', { count: alerts.length });
    return alerts;
  }

  // Plan SC: FR-R246.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
