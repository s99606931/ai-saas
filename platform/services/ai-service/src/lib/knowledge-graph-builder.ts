// 팀 지식 그래프 자동 구축 -- FR-N383.1~FR-N383.5
// Design Ref: MTU-N383 | CSAP: D-06, D-08

export type EntityType = 'person' | 'task' | 'document' | 'team';

export interface GraphNode {
  readonly id: string;
  readonly type: EntityType;
  readonly name: string;
  readonly attributes: Record<string, string>;
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: string;
  readonly weight: number;
}

export interface KnowledgeGraph {
  readonly nodes: GraphNode[];
  readonly edges: GraphEdge[];
}

export interface KgAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: KgAuditEntry[] = [];

function recordAudit(entry: Omit<KgAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getKgAuditLog(tenantId: string): readonly KgAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function createGraph(): KnowledgeGraph {
  return { nodes: [], edges: [] };
}

export function addNode(graph: KnowledgeGraph, node: GraphNode): KnowledgeGraph {
  if (!graph.nodes.find((n) => n.id === node.id)) {
    graph.nodes.push(node);
  }
  return graph;
}

export function addEdge(graph: KnowledgeGraph, edge: GraphEdge): KnowledgeGraph {
  const existing = graph.edges.find((e) => e.from === edge.from && e.to === edge.to && e.relation === edge.relation);
  if (existing) {
    const idx = graph.edges.indexOf(existing);
    graph.edges[idx] = { ...existing, weight: existing.weight + edge.weight };
  } else {
    graph.edges.push(edge);
  }
  return graph;
}

export interface TextEntity {
  readonly text: string;
  readonly type: EntityType;
}

const KNOWN_NAMES = ['홍길동', '이순신', '김철수', '박영희', '강감찬', '이황', '이이'];

export function extractEntities(text: string): readonly TextEntity[] {
  const entities: TextEntity[] = [];
  const seen = new Set<string>();
  // 알려진 이름 매칭
  for (const name of KNOWN_NAMES) {
    if (text.includes(name) && !seen.has(name)) {
      seen.add(name);
      entities.push({ text: name, type: 'person' });
    }
  }
  // 업무 패턴 매칭
  const taskRegex = /([가-힣]+\s*업무)/g;
  let match: RegExpExecArray | null;
  while ((match = taskRegex.exec(text)) !== null) {
    const task = match[1] ?? '';
    if (!seen.has(task)) {
      seen.add(task);
      entities.push({ text: task, type: 'task' });
    }
  }
  return entities;
}

export function buildFromText(tenantId: string, text: string): KnowledgeGraph {
  const graph = createGraph();
  const entities = extractEntities(text);
  for (const e of entities) {
    addNode(graph, {
      id: `${e.type}:${e.text}`,
      type: e.type,
      name: e.text,
      attributes: {},
    });
  }
  // 공동 출현 기반 관계 추가
  const people = entities.filter((e) => e.type === 'person');
  const tasks = entities.filter((e) => e.type === 'task');
  for (const p of people) {
    for (const t of tasks) {
      addEdge(graph, {
        from: `person:${p.text}`,
        to: `task:${t.text}`,
        relation: 'responsible_for',
        weight: 1,
      });
    }
  }
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'KG_BUILT',
    target: 'text',
    details: { nodeCount: graph.nodes.length, edgeCount: graph.edges.length },
  });
  return graph;
}

export function queryRelated(graph: KnowledgeGraph, nodeId: string, depth = 1): readonly GraphNode[] {
  const visited = new Set<string>([nodeId]);
  let frontier = [nodeId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const e of graph.edges) {
        if (e.from === cur && !visited.has(e.to)) {
          visited.add(e.to);
          next.push(e.to);
        } else if (e.to === cur && !visited.has(e.from)) {
          visited.add(e.from);
          next.push(e.from);
        }
      }
    }
    frontier = next;
  }
  visited.delete(nodeId);
  return graph.nodes.filter((n) => visited.has(n.id));
}

export class KnowledgeGraphBuilderService {
  private graph: KnowledgeGraph = createGraph();
  constructor(private readonly tenantId: string) {}
  build(text: string): KnowledgeGraph {
    this.graph = buildFromText(this.tenantId, text);
    return this.graph;
  }
  query(nodeId: string, depth = 1): readonly GraphNode[] {
    return queryRelated(this.graph, nodeId, depth);
  }
  getGraph(): KnowledgeGraph {
    return this.graph;
  }
  getAuditLog(): readonly KgAuditEntry[] {
    return getKgAuditLog(this.tenantId);
  }
}
