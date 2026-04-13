// Design Ref: §스마트시티 지표 가중 평균 집계
// Plan SC: FR-R611.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type MetricDomain = 'traffic' | 'environment' | 'safety' | 'energy' | 'welfare';

interface CityMetric {
  domain: MetricDomain;
  name: string;
  value: number;
  unit: string;
  weight: number;
  reportedAt: string;
}

interface DashboardSnapshot {
  cityId: string;
  compositeIndex: number;
  domainScores: Record<MetricDomain, number>;
  metricCount: number;
  generatedAt: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

// Plan SC: FR-R611.5
function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class AISmartCityDashboardAggregator {
  private cityMetrics = new Map<string, CityMetric[]>();
  private snapshots: DashboardSnapshot[] = [];
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R611.1
  registerMetric(cityId: string, metric: CityMetric, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (metric.weight < 0 || metric.weight > 1) {
      throw new Error('가중치는 0~1 범위여야 합니다');
    }
    const list = this.cityMetrics.get(cityId) ?? [];
    list.push(metric);
    this.cityMetrics.set(cityId, list);
    this.log('REGISTER_METRIC', { cityId, domain: metric.domain, name: metric.name });
  }

  // Plan SC: FR-R611.2
  private computeDomainScore(metrics: CityMetric[], domain: MetricDomain): number {
    const filtered = metrics.filter(m => m.domain === domain);
    if (filtered.length === 0) return 0;
    const weightSum = filtered.reduce((acc, m) => acc + m.weight, 0);
    if (weightSum === 0) return 0;
    const weighted = filtered.reduce((acc, m) => acc + m.value * m.weight, 0);
    return Math.round((weighted / weightSum) * 100) / 100;
  }

  // Plan SC: FR-R611.3
  aggregate(cityId: string, grade: DataGrade = DataGrade.O): DashboardSnapshot {
    blockClassifiedData(grade);
    const metrics = this.cityMetrics.get(cityId) ?? [];
    if (metrics.length === 0) {
      throw new Error(`지표 없음: ${cityId}`);
    }

    const domains: MetricDomain[] = ['traffic', 'environment', 'safety', 'energy', 'welfare'];
    const domainScores: Record<MetricDomain, number> = {
      traffic: 0, environment: 0, safety: 0, energy: 0, welfare: 0,
    };

    let compositeSum = 0;
    let activeDomains = 0;
    for (const d of domains) {
      const s = this.computeDomainScore(metrics, d);
      domainScores[d] = s;
      if (s > 0) {
        compositeSum += s;
        activeDomains += 1;
      }
    }

    const compositeIndex = activeDomains === 0
      ? 0
      : Math.round((compositeSum / activeDomains) * 100) / 100;

    const snapshot: DashboardSnapshot = {
      cityId,
      compositeIndex,
      domainScores,
      metricCount: metrics.length,
      generatedAt: new Date().toISOString(),
    };
    this.snapshots.push(snapshot);
    this.log('AGGREGATE', { cityId, compositeIndex, metricCount: metrics.length });
    return snapshot;
  }

  // Plan SC: FR-R611.4
  getLatestSnapshot(cityId: string): DashboardSnapshot | undefined {
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      const snap = this.snapshots[i];
      if (snap && snap.cityId === cityId) return snap;
    }
    return undefined;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
