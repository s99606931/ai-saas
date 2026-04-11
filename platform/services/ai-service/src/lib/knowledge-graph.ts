// 인메모리 지식 그래프 -- FR-ADV5.3, FR-ADV5.4
// Design Ref: SVC-AI-ADV-R5 DESIGN §2
// 노드(엔티티) + 엣지(관계) 기반 그래프, 테넌트별 격리
// CSAP: D-12 시스템 개발 보안, N2SF N-05 O등급 전용

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export type EntityType = 'law' | 'article' | 'organization' | 'policy' | 'concept';
export type RelationType = 'references' | 'amends' | 'supersedes' | 'parent_of' | 'related_to';

export interface GraphNode {
  id: string;
  type: EntityType;
  name: string;
  metadata: Record<string, unknown>;
  /** 이 엔티티가 추출된 문서 ID */
  documentId?: string;
  /** 이 엔티티가 추출된 청크 인덱스 */
  chunkIndex?: number;
}

export interface GraphEdge {
  source: string; // 노드 ID
  target: string; // 노드 ID
  relation: RelationType;
  weight: number; // 0~1 관계 강도
}

export interface GraphSearchResult {
  node: GraphNode;
  depth: number; // 시작 노드에서의 hop 수
  path: string[]; // 경로 (노드 ID 배열)
}

// ── 지식 그래프 클래스 ────────────────────────────────────────────────────

/**
 * 인메모리 지식 그래프
 * Plan SC: FR-ADV5.3
 *
 * 노드(엔티티)와 엣지(관계)로 구성된 방향 그래프.
 * BFS 기반 N-hop 탐색 지원.
 */
export class KnowledgeGraph {
  private readonly tenantId: string;
  private readonly nodes = new Map<string, GraphNode>();
  private readonly adjacency = new Map<string, Array<{ targetId: string; edge: GraphEdge }>>();
  private readonly reverseAdj = new Map<string, Array<{ sourceId: string; edge: GraphEdge }>>();

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * 노드 추가 (중복 시 메타데이터 병합)
   */
  addNode(node: GraphNode): void {
    const existing = this.nodes.get(node.id);
    if (existing) {
      existing.metadata = { ...existing.metadata, ...node.metadata };
    } else {
      this.nodes.set(node.id, { ...node });
    }
  }

  /**
   * 엣지 추가
   */
  addEdge(edge: GraphEdge): void {
    // 순방향
    if (!this.adjacency.has(edge.source)) {
      this.adjacency.set(edge.source, []);
    }
    this.adjacency.get(edge.source)!.push({ targetId: edge.target, edge });

    // 역방향 (양방향 탐색용)
    if (!this.reverseAdj.has(edge.target)) {
      this.reverseAdj.set(edge.target, []);
    }
    this.reverseAdj.get(edge.target)!.push({ sourceId: edge.source, edge });
  }

  /**
   * 노드 조회
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * 이름으로 노드 검색 (부분 매칭)
   */
  findNodesByName(query: string): GraphNode[] {
    const normalizedQuery = query.toLowerCase();
    const results: GraphNode[] = [];

    for (const node of this.nodes.values()) {
      if (node.name.toLowerCase().includes(normalizedQuery)) {
        results.push(node);
      }
    }

    return results;
  }

  /**
   * 타입으로 노드 필터
   */
  findNodesByType(type: EntityType): GraphNode[] {
    return [...this.nodes.values()].filter((n) => n.type === type);
  }

  /**
   * BFS 기반 N-hop 관련 노드 탐색
   * Plan SC: FR-ADV5.4
   *
   * @param startNodeId 시작 노드 ID
   * @param maxHops 최대 hop 수 (기본 2)
   * @param maxResults 최대 결과 수 (기본 20)
   */
  explore(
    startNodeId: string,
    maxHops = 2,
    maxResults = 20,
  ): GraphSearchResult[] {
    if (!this.nodes.has(startNodeId)) return [];

    const visited = new Set<string>();
    const results: GraphSearchResult[] = [];
    const queue: Array<{ nodeId: string; depth: number; path: string[] }> = [
      { nodeId: startNodeId, depth: 0, path: [startNodeId] },
    ];

    visited.add(startNodeId);

    while (queue.length > 0 && results.length < maxResults) {
      const current = queue.shift();
      if (!current) break;

      const node = this.nodes.get(current.nodeId);
      if (!node) continue;

      if (current.depth > 0) {
        results.push({
          node,
          depth: current.depth,
          path: current.path,
        });
      }

      if (current.depth >= maxHops) continue;

      // 순방향 이웃
      const neighbors = this.adjacency.get(current.nodeId) ?? [];
      for (const { targetId } of neighbors) {
        if (!visited.has(targetId)) {
          visited.add(targetId);
          queue.push({
            nodeId: targetId,
            depth: current.depth + 1,
            path: [...current.path, targetId],
          });
        }
      }

      // 역방향 이웃 (양방향 탐색)
      const reverseNeighbors = this.reverseAdj.get(current.nodeId) ?? [];
      for (const { sourceId } of reverseNeighbors) {
        if (!visited.has(sourceId)) {
          visited.add(sourceId);
          queue.push({
            nodeId: sourceId,
            depth: current.depth + 1,
            path: [...current.path, sourceId],
          });
        }
      }
    }

    return results;
  }

  /**
   * 텍스트에서 매칭되는 노드 찾기 (엔티티 링킹)
   */
  linkEntities(text: string): GraphNode[] {
    const matched: GraphNode[] = [];

    for (const node of this.nodes.values()) {
      // 정확한 이름 매칭 (2글자 이상)
      if (node.name.length >= 2 && text.includes(node.name)) {
        matched.push(node);
      }
    }

    return matched;
  }

  /**
   * 그래프 통계
   */
  get stats(): { nodeCount: number; edgeCount: number; tenantId: string } {
    let edgeCount = 0;
    for (const edges of this.adjacency.values()) {
      edgeCount += edges.length;
    }
    return { nodeCount: this.nodes.size, edgeCount, tenantId: this.tenantId };
  }

  /**
   * 그래프 초기화
   */
  clear(): void {
    this.nodes.clear();
    this.adjacency.clear();
    this.reverseAdj.clear();
  }
}

// ── 테넌트별 그래프 캐시 ────────────────────────────────────────────────────

const graphCache = new Map<string, KnowledgeGraph>();
const GRAPH_CACHE_MAX = 50;

/**
 * 테넌트별 Knowledge Graph 조회 또는 생성
 */
export function getOrCreateGraph(tenantId: string): KnowledgeGraph {
  const existing = graphCache.get(tenantId);
  if (existing) return existing;

  const graph = new KnowledgeGraph(tenantId);

  if (graphCache.size >= GRAPH_CACHE_MAX) {
    const oldestKey = graphCache.keys().next().value;
    if (oldestKey !== undefined) {
      graphCache.delete(oldestKey);
    }
  }
  graphCache.set(tenantId, graph);
  return graph;
}

/**
 * 그래프 캐시 무효화
 */
export function invalidateGraph(tenantId: string): void {
  graphCache.delete(tenantId);
}
