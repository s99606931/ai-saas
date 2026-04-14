// Design Ref: §부하점수 — cpu×0.5+mem×0.3+min(req/1000,1)×100×0.2, 불균형: max-min>30
// Plan SC: SC-R604-1, SC-R604-2, SC-R604-3

interface NodeLoad {
  nodeId: string;
  cpuUsage: number;
  memUsage: number;
  requestCount: number;
}

type NodeStatus = 'OVERLOADED' | 'HEAVY' | 'NORMAL';

interface NodeResult {
  nodeId: string;
  loadScore: number;
  status: NodeStatus;
}

interface LoadDistributionResult {
  clusterId: string;
  nodes: NodeResult[];
  avgLoad: number;
  isImbalanced: boolean;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  clusterId: string;
  avgLoad: number;
  isImbalanced: boolean;
}

export class RealtimeLoadDistributionOptimizer {
  private readonly auditLog: AuditEntry[] = [];

  analyze(clusterId: string, nodes: NodeLoad[]): LoadDistributionResult {
    const results: NodeResult[] = nodes.map((node) => {
      const loadScore = this.computeScore(node);
      return { nodeId: node.nodeId, loadScore: Math.round(loadScore * 100) / 100, status: this.classifyStatus(loadScore) };
    });

    const scores = results.map((r) => r.loadScore);
    const avgLoad = scores.length > 0
      ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100
      : 0;
    const isImbalanced = scores.length > 1
      ? Math.max(...scores) - Math.min(...scores) > 30
      : false;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'LOAD_DISTRIBUTION_ANALYZED',
      clusterId,
      avgLoad,
      isImbalanced,
    });

    return { clusterId, nodes: results, avgLoad, isImbalanced };
  }

  private computeScore(node: NodeLoad): number {
    return node.cpuUsage * 0.5 + node.memUsage * 0.3 + Math.min(node.requestCount / 1000, 1) * 100 * 0.2;
  }

  private classifyStatus(score: number): NodeStatus {
    if (score >= 80) return 'OVERLOADED';
    if (score >= 60) return 'HEAVY';
    return 'NORMAL';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
