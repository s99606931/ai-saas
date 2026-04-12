// Cross-Document Reasoning — FR-R56.1~R56.6
// Design Ref: SVC-AI-ADV-R56 DESIGN §2, §3, §4
// Plan SC: 2홉+ 참조 질의 정답률 +25%
// CSAP: D-12, D-06

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type DataGrade = 'O' | 'C' | 'S';

export interface Document {
  id: string;
  title: string;
  entities: string[];
  grade: DataGrade;
}

export interface Reference {
  from: string;
  to: string;
  kind: 'cite' | 'derive' | 'amend';
  weight?: number;
}

export interface ReasoningChain {
  path: string[];
  hops: number;
  evidence: Document[];
}

export interface ReasonInput {
  entities: string[];
  maxDepth?: number;
  maxChains?: number;
}

export interface ReasonAuditEntry {
  timestamp: number;
  action: 'ADD_DOC' | 'ADD_REF' | 'REASON' | 'BLOCK_GRADE' | 'CYCLE_BLOCKED';
  detail?: string;
}

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_CHAINS = 20;

// ── CrossDocumentReasoning ───────────────────────────────────────────────────

/**
 * 문서 참조 그래프(BFS) 기반 추론 체인 생성기.
 * C/S 등급 문서는 그래프에 등록할 수 없습니다(N2SF 준수).
 */
export class CrossDocumentReasoning {
  private readonly documents = new Map<string, Document>();
  private readonly outgoing = new Map<string, Reference[]>();
  private readonly auditLog: ReasonAuditEntry[] = [];

  // ── FR-R56.1: 문서 등록 ──────────────────────────────────────────────────

  addDocument(doc: Document): void {
    if (doc.grade !== 'O') {
      this.audit({ timestamp: Date.now(), action: 'BLOCK_GRADE', detail: doc.id });
      throw new Error('REASON_GRADE_BLOCKED');
    }
    this.documents.set(doc.id, doc);
    if (!this.outgoing.has(doc.id)) {
      this.outgoing.set(doc.id, []);
    }
    this.audit({ timestamp: Date.now(), action: 'ADD_DOC', detail: doc.id });
  }

  // ── FR-R56.2: 참조 엣지 ──────────────────────────────────────────────────

  addReference(ref: Reference): void {
    if (!this.documents.has(ref.from) || !this.documents.has(ref.to)) {
      throw new Error('REASON_UNKNOWN_DOC');
    }
    const list = this.outgoing.get(ref.from) ?? [];
    list.push(ref);
    this.outgoing.set(ref.from, list);
    this.audit({
      timestamp: Date.now(),
      action: 'ADD_REF',
      detail: `${ref.from}->${ref.to}`,
    });
  }

  // ── FR-R56.3: 엔티티 시드 탐색 ───────────────────────────────────────────

  findSeeds(entities: string[]): string[] {
    const seeds: string[] = [];
    for (const [id, doc] of this.documents) {
      if (doc.entities.some((e) => entities.includes(e))) {
        seeds.push(id);
      }
    }
    return seeds;
  }

  // ── FR-R56.4: BFS 체인 생성 ──────────────────────────────────────────────

  reason(input: ReasonInput): ReasoningChain[] {
    const maxDepth = input.maxDepth ?? DEFAULT_MAX_DEPTH;
    const maxChains = input.maxChains ?? DEFAULT_MAX_CHAINS;
    const seeds = this.findSeeds(input.entities);
    const chains: ReasoningChain[] = [];

    for (const seed of seeds) {
      // per-seed BFS
      const queue: Array<{ node: string; path: string[] }> = [
        { node: seed, path: [seed] },
      ];
      const visited = new Set<string>();

      while (queue.length > 0 && chains.length < maxChains) {
        const item = queue.shift();
        if (!item) break;
        const { node, path } = item;

        if (visited.has(node)) {
          this.audit({
            timestamp: Date.now(),
            action: 'CYCLE_BLOCKED',
            detail: node,
          });
          continue;
        }
        visited.add(node);

        chains.push(this.toChain(path));

        if (path.length - 1 >= maxDepth) {
          continue;
        }

        const edges = this.outgoing.get(node) ?? [];
        for (const edge of edges) {
          if (!path.includes(edge.to) && !visited.has(edge.to)) {
            queue.push({ node: edge.to, path: [...path, edge.to] });
          }
        }
      }

      if (chains.length >= maxChains) break;
    }

    this.audit({
      timestamp: Date.now(),
      action: 'REASON',
      detail: `chains=${chains.length}`,
    });
    return chains;
  }

  // ── FR-R56.6: 감사 ───────────────────────────────────────────────────────

  getAuditLog(): readonly ReasonAuditEntry[] {
    return this.auditLog;
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  // ── 내부 ──────────────────────────────────────────────────────────────────

  private toChain(path: string[]): ReasoningChain {
    const evidence: Document[] = [];
    for (const id of path) {
      const d = this.documents.get(id);
      if (d) evidence.push(d);
    }
    return {
      path: [...path],
      hops: path.length - 1,
      evidence,
    };
  }

  private audit(entry: ReasonAuditEntry): void {
    this.auditLog.push(entry);
  }
}
