// Design Ref: SVC-AI-ADV-R637.design.md §설계결정
// Plan SC: FR-R637.1~5
// 트랙 B 23차

interface EntityRecord { id: string; type: string; label: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class KnowledgeGraphEnricherV3 {
  private entities = new Map<string, EntityRecord>();
  private edges = new Map<string, Set<string>>();
  private auditLog: AuditEntry[] = [];

  registerEntity(id: string, type: string, label: string): void {
    this.entities.set(id, { id, type, label });
    if (!this.edges.has(id)) this.edges.set(id, new Set());
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_ENTITY',
      details: { id, type, label },
    });
  }

  addRelation(fromId: string, toId: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
    }
    if (!this.edges.has(fromId)) this.edges.set(fromId, new Set());
    if (!this.edges.has(toId)) this.edges.set(toId, new Set());
    this.edges.get(fromId)!.add(toId);
    this.edges.get(toId)!.add(fromId);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ADD_RELATION',
      details: { fromId, toId },
    });
  }

  getEnrichmentScore(id: string): number {
    const neighbors = this.edges.get(id);
    if (!neighbors || neighbors.size === 0) return 0;
    const counts = Array.from(this.edges.values()).map((s) => s.size);
    const max = counts.length === 0 ? 0 : Math.max(...counts);
    if (max === 0) return 0;
    return neighbors.size / max;
  }

  getLowConnectivityEntities(threshold: number): EntityRecord[] {
    return Array.from(this.entities.values()).filter(
      (e) => this.getEnrichmentScore(e.id) <= threshold,
    );
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
