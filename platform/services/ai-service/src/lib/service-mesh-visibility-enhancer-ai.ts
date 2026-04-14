// Design Ref: §엣지 상태 — latency>1000||errRate>0.1:CRITICAL / latency>500||errRate>0.05:DEGRADED
// Plan SC: SC-R542-1, SC-R542-2, SC-R542-3

interface MeshEdge {
  from: string;
  to: string;
  latencyMs: number;
  errorRate: number;
  requestsPerMin: number;
}

type EdgeStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

interface EdgeStatusEntry {
  from: string;
  to: string;
  status: EdgeStatus;
}

interface MeshAnalysisResult {
  meshId: string;
  overallScore: number;
  edgeStatuses: EdgeStatusEntry[];
  hotspots: { from: string; to: string }[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  meshId: string;
  overallScore: number;
  hotspotCount: number;
}

export class ServiceMeshVisibilityEnhancerAI {
  private readonly auditLog: AuditEntry[] = [];

  analyze(meshId: string, edges: MeshEdge[]): MeshAnalysisResult {
    const edgeStatuses = edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      status: this.classifyEdge(edge),
    }));

    const healthyCount = edgeStatuses.filter((e) => e.status === 'HEALTHY').length;
    const overallScore = edges.length > 0 ? Math.round((healthyCount / edges.length) * 100 * 100) / 100 : 100;
    const hotspots = edgeStatuses
      .filter((e) => e.status === 'CRITICAL')
      .map((e) => ({ from: e.from, to: e.to }));

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'MESH_ANALYZED',
      meshId,
      overallScore,
      hotspotCount: hotspots.length,
    });

    return { meshId, overallScore, edgeStatuses, hotspots };
  }

  private classifyEdge(edge: MeshEdge): EdgeStatus {
    if (edge.latencyMs > 1000 || edge.errorRate > 0.1) return 'CRITICAL';
    if (edge.latencyMs > 500 || edge.errorRate > 0.05) return 'DEGRADED';
    return 'HEALTHY';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
