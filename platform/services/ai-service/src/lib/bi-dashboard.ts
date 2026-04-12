// Design Ref: MTU-N471 §BI KPI 대시보드
// Plan SC: FR-BI.1~5

export interface KpiDefinition {
  id: string;
  name: string;
  unit: string;
  aggregation: 'sum' | 'avg' | 'max' | 'min' | 'count';
  source: string;
  threshold?: { warning: number; critical: number };
}

export interface DataPoint {
  kpiId: string;
  value: number;
  timestamp: string;
}

export interface DashboardLayout {
  title: string;
  rows: Array<{ kpiId: string; widget: 'gauge' | 'line' | 'bar' | 'counter' }>;
}

export interface KpiAlert {
  kpiId: string;
  level: 'warning' | 'critical';
  value: number;
  at: string;
}

export class BiDashboard {
  private kpis = new Map<string, KpiDefinition>();
  private dataPoints: DataPoint[] = [];

  /** FR-BI.1 KPI 레지스트리 */
  registerKpi(kpi: KpiDefinition): KpiDefinition {
    this.kpis.set(kpi.id, kpi);
    return kpi;
  }

  /** FR-BI.2 데이터 소스 인제스트 */
  ingest(point: DataPoint): void {
    if (!this.kpis.has(point.kpiId)) throw new Error('KPI 없음');
    this.dataPoints.push(point);
  }

  /** FR-BI.3 실시간 집계 */
  aggregate(kpiId: string): number {
    const kpi = this.kpis.get(kpiId);
    if (!kpi) throw new Error('KPI 없음');
    const pts = this.dataPoints.filter((p) => p.kpiId === kpiId);
    if (pts.length === 0) return 0;
    const values = pts.map((p) => p.value);
    switch (kpi.aggregation) {
      case 'sum':
        return +values.reduce((a, b) => a + b, 0).toFixed(3);
      case 'avg':
        return +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(3);
      case 'max':
        return Math.max(...values);
      case 'min':
        return Math.min(...values);
      case 'count':
        return values.length;
    }
  }

  /** FR-BI.4 대시보드 레이아웃 생성 */
  generateLayout(title: string, kpiIds: string[]): DashboardLayout {
    return {
      title,
      rows: kpiIds.map((id) => ({
        kpiId: id,
        widget: this.recommendWidget(id),
      })),
    };
  }

  /** FR-BI.5 알림 */
  checkAlerts(): KpiAlert[] {
    const alerts: KpiAlert[] = [];
    for (const kpi of this.kpis.values()) {
      if (!kpi.threshold) continue;
      const value = this.aggregate(kpi.id);
      if (value >= kpi.threshold.critical) {
        alerts.push({ kpiId: kpi.id, level: 'critical', value, at: new Date().toISOString() });
      } else if (value >= kpi.threshold.warning) {
        alerts.push({ kpiId: kpi.id, level: 'warning', value, at: new Date().toISOString() });
      }
    }
    return alerts;
  }

  private recommendWidget(kpiId: string): 'gauge' | 'line' | 'bar' | 'counter' {
    const kpi = this.kpis.get(kpiId);
    if (!kpi) return 'counter';
    if (kpi.aggregation === 'avg' || kpi.aggregation === 'max') return 'gauge';
    if (kpi.aggregation === 'count') return 'counter';
    return 'line';
  }
}

export const biDashboard = new BiDashboard();
