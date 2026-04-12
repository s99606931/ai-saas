// SVC-AI-ADV-R353 Data Lineage Tracker v2 (Field-level)
// Design Ref: SVC-AI-ADV-R353.design.md
// Plan SC: SC-R353-1~4
// CSAP: D-06 감사, N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface FieldNode {
  readonly datasetId: string;
  readonly field: string;
}

export interface LineageEdge {
  readonly source: FieldNode;
  readonly target: FieldNode;
  readonly transform: string;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

function nodeKey(node: FieldNode): string {
  return `${node.datasetId}::${node.field}`;
}

export class DataLineageTrackerV2 {
  private readonly forward = new Map<string, LineageEdge[]>();
  private readonly backward = new Map<string, LineageEdge[]>();
  private readonly auditLog: AuditEntry[] = [];

  recordTransform(edge: LineageEdge, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 변환 정보 추적 금지 (N2SF N-05)`);
    }
    const srcKey = nodeKey(edge.source);
    const tgtKey = nodeKey(edge.target);
    const fwd = this.forward.get(srcKey) ?? [];
    fwd.push(edge);
    this.forward.set(srcKey, fwd);
    const bwd = this.backward.get(tgtKey) ?? [];
    bwd.push(edge);
    this.backward.set(tgtKey, bwd);
    this.record('RECORD', `${srcKey}->${tgtKey}`, { transform: edge.transform });
  }

  getDownstream(node: FieldNode): readonly FieldNode[] {
    return this.bfs(node, this.forward, (e) => e.target);
  }

  getUpstream(node: FieldNode): readonly FieldNode[] {
    return this.bfs(node, this.backward, (e) => e.source);
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private bfs(
    start: FieldNode,
    edges: Map<string, LineageEdge[]>,
    nextOf: (e: LineageEdge) => FieldNode,
  ): FieldNode[] {
    const visited = new Set<string>();
    const queue: FieldNode[] = [start];
    const result: FieldNode[] = [];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      const key = nodeKey(current);
      if (visited.has(key)) continue;
      visited.add(key);
      if (key !== nodeKey(start)) {
        result.push(current);
      }
      const outgoing = edges.get(key) ?? [];
      for (const edge of outgoing) {
        queue.push(nextOf(edge));
      }
    }
    return result;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
