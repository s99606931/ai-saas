// Design Ref: §핵심 알고리즘 — 그래프 노드/엣지 + degree 기반 핵심 서비스
// Plan SC: FR-R289.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ServiceNode {
  id: string;
  name: string;
  type: string;
}

interface Edge {
  toId: string;
  weight: number;
}

interface CriticalServiceInfo {
  id: string;
  name: string;
  degree: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R289.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class ServiceEcosystemMapperAI {
  private nodes = new Map<string, ServiceNode>();
  private edges = new Map<string, Edge[]>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R289.1
  registerNode(id: string, name: string, type: string): void {
    this.nodes.set(id, { id, name, type });
    this.edges.set(id, []);
    this.log('REGISTER_NODE', { id, name, type });
  }

  // Plan SC: FR-R289.2
  addEdge(fromId: string, toId: string, weight: number = 1, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.nodes.has(fromId)) throw new Error(`노드 미등록: ${fromId}`);
    if (!this.nodes.has(toId)) throw new Error(`노드 미등록: ${toId}`);
    this.edges.get(fromId)!.push({ toId, weight });
    this.log('ADD_EDGE', { fromId, toId, weight });
  }

  // Plan SC: FR-R289.3
  getNeighbors(serviceId: string): ServiceNode[] {
    if (!this.nodes.has(serviceId)) throw new Error(`노드 미등록: ${serviceId}`);
    const outEdges = this.edges.get(serviceId) ?? [];
    return outEdges.map(e => this.nodes.get(e.toId)!).filter(Boolean);
  }

  // Plan SC: FR-R289.4
  getCriticalServices(topN: number = 5): CriticalServiceInfo[] {
    const degreeMap = new Map<string, number>();
    for (const id of this.nodes.keys()) degreeMap.set(id, 0);

    for (const [fromId, edgeList] of this.edges.entries()) {
      degreeMap.set(fromId, (degreeMap.get(fromId) ?? 0) + edgeList.length);
      for (const edge of edgeList) {
        degreeMap.set(edge.toId, (degreeMap.get(edge.toId) ?? 0) + 1);
      }
    }

    return Array.from(this.nodes.values())
      .map(n => ({ id: n.id, name: n.name, degree: degreeMap.get(n.id) ?? 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, topN);
  }

  // Plan SC: FR-R289.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
