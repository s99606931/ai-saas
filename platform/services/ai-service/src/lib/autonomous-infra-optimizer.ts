// Design Ref: §R171 AI기반자율인프라최적화
// Plan SC: FR-R171.1~5

export type ResourceType = 'cpu' | 'memory' | 'storage' | 'network';

export interface ResourceMetric {
  nodeId: string;
  type: ResourceType;
  utilizationPct: number;
  timestamp: number;
}

export interface OptimizationAction {
  nodeId: string;
  action: 'scale_up' | 'scale_down' | 'rebalance' | 'evict';
  reason: string;
  estimatedSavingPct: number;
}

export interface InfraReport {
  timestamp: string;
  totalNodes: number;
  avgUtilization: number;
  actions: OptimizationAction[];
  estimatedSavingPct: number;
}

export interface AuditEntry {
  action: string;
  nodeId?: string;
  timestamp: string;
}

export class AutonomousInfraOptimizer {
  private metrics = new Map<string, ResourceMetric[]>();
  private auditLog: AuditEntry[] = [];

  // FR-R171.1 메트릭 수집
  recordMetric(metric: ResourceMetric): void {
    const key = `${metric.nodeId}:${metric.type}`;
    const list = this.metrics.get(key) ?? [];
    list.push({ ...metric });
    this.metrics.set(key, list);
  }

  // FR-R171.2 이상 노드 탐지 (임계값 기반)
  detectAnomalies(highThreshold = 85, lowThreshold = 15): string[] {
    const anomalous: string[] = [];
    for (const [key, records] of this.metrics) {
      if (records.length === 0) continue;
      const avg = records.reduce((s, r) => s + r.utilizationPct, 0) / records.length;
      if (avg > highThreshold || avg < lowThreshold) {
        anomalous.push(key);
      }
    }
    return anomalous;
  }

  // FR-R171.3 자율 최적화 액션 생성
  generateActions(): OptimizationAction[] {
    const actions: OptimizationAction[] = [];
    const nodeMap = new Map<string, number[]>();

    for (const [key, records] of this.metrics) {
      const [nodeId] = key.split(':');
      if (!nodeId) continue;
      const avg = records.reduce((s, r) => s + r.utilizationPct, 0) / records.length;
      const existing = nodeMap.get(nodeId) ?? [];
      existing.push(avg);
      nodeMap.set(nodeId, existing);
    }

    for (const [nodeId, avgs] of nodeMap) {
      const overall = avgs.reduce((s, v) => s + v, 0) / avgs.length;
      if (overall > 85) {
        actions.push({ nodeId, action: 'scale_up', reason: `평균 사용률 ${overall.toFixed(1)}% 초과`, estimatedSavingPct: 0 });
      } else if (overall < 15) {
        actions.push({ nodeId, action: 'scale_down', reason: `평균 사용률 ${overall.toFixed(1)}% 미달 — 비용 절감`, estimatedSavingPct: 30 });
      } else if (overall > 70) {
        actions.push({ nodeId, action: 'rebalance', reason: `사용률 ${overall.toFixed(1)}% — 부하 분산 권장`, estimatedSavingPct: 10 });
      }
    }

    this.auditLog.push({ action: 'ACTIONS_GENERATED', timestamp: new Date().toISOString() });
    return actions;
  }

  // FR-R171.4 최적화 리포트
  generateReport(): InfraReport {
    const actions = this.generateActions();
    const nodeIds = new Set<string>();
    let totalUtil = 0;
    let count = 0;

    for (const [key, records] of this.metrics) {
      const [nodeId] = key.split(':');
      if (nodeId) nodeIds.add(nodeId);
      totalUtil += records.reduce((s, r) => s + r.utilizationPct, 0);
      count += records.length;
    }

    const avgSaving = actions.length === 0
      ? 0
      : actions.reduce((s, a) => s + a.estimatedSavingPct, 0) / actions.length;

    return {
      timestamp: new Date().toISOString(),
      totalNodes: nodeIds.size,
      avgUtilization: count === 0 ? 0 : +(totalUtil / count).toFixed(1),
      actions,
      estimatedSavingPct: +avgSaving.toFixed(1),
    };
  }

  // FR-R171.5 감사 로그 (CSAP D-06)
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
