// Federated RAG — FR-R60.1~R60.6
// Design Ref: SVC-AI-ADV-R60 DESIGN §모듈 구조
// Plan SC: 연합 검색 Top-10 정확도 +10%p, 부분 실패 허용
// CSAP: D-04 자산관리 / D-06 감사 / D-10 운영 / D-11 사고대응
// N2SF: 데이터 주권, 원본 로컬 상주

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type DataGrade = 'C' | 'S' | 'O';

export interface FederatedNode {
  id: string;
  endpoint: string;
  /** RRF 결합 시 가중치 */
  weight: number;
  /** 라우팅 가능 여부 */
  healthy: boolean;
}

export interface FederatedResult {
  docId: string;
  score: number;
  sourceNode: string;
  snippet: string;
}

export interface SearchOpts {
  topK: number;
  /** 최소 성공 노드 수 (미달 시 에러) */
  minNodes: number;
  /** 노드별 타임아웃 (ms) */
  timeoutMs: number;
  /** 요청 데이터 등급 */
  grade?: DataGrade;
}

export interface FederatedAuditEntry {
  timestamp: string;
  action:
    | 'NODE_REGISTER'
    | 'NODE_UNREGISTER'
    | 'SEARCH'
    | 'PARTIAL_FAILURE'
    | 'BREAKER_OPEN'
    | 'GRADE_BLOCKED';
  nodeId?: string;
  detail?: string;
}

interface BreakerState {
  failCount: number;
  totalCount: number;
  open: boolean;
}

type SearchFn = (query: string, topK: number) => Promise<FederatedResult[]>;

// ── FederatedRAG ─────────────────────────────────────────────────────────────

const BREAKER_WINDOW = 10;
const BREAKER_FAIL_RATIO = 0.5;

export class FederatedRAG {
  private readonly nodes = new Map<string, FederatedNode>();
  private readonly searchFns = new Map<string, SearchFn>();
  private readonly breakers = new Map<string, BreakerState>();
  private readonly auditLog: FederatedAuditEntry[] = [];

  // FR-R60.1
  registerNode(node: FederatedNode, searchFn: SearchFn): void {
    if (!node.id) throw new Error('FED_INVALID_NODE');
    if (node.weight <= 0) throw new Error('FED_INVALID_WEIGHT');
    this.nodes.set(node.id, { ...node });
    this.searchFns.set(node.id, searchFn);
    this.breakers.set(node.id, { failCount: 0, totalCount: 0, open: false });
    this.audit('NODE_REGISTER', node.id);
  }

  unregisterNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) return;
    this.nodes.delete(nodeId);
    this.searchFns.delete(nodeId);
    this.breakers.delete(nodeId);
    this.audit('NODE_UNREGISTER', nodeId);
  }

  listNodes(): FederatedNode[] {
    return Array.from(this.nodes.values()).map((n) => ({ ...n }));
  }

  // FR-R60.6 (등급 검사)
  enforceDataGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      this.audit('GRADE_BLOCKED', undefined, `N2SF ${grade}`);
      throw new Error(`BLOCKED: ${grade}등급 데이터는 연합 검색 금지 (N2SF N-05)`);
    }
  }

  // FR-R60.2: 병렬 연합 검색
  async federatedSearch(query: string, opts: SearchOpts): Promise<FederatedResult[]> {
    if (opts.grade) this.enforceDataGrade(opts.grade);
    if (opts.topK <= 0) throw new Error('FED_INVALID_TOPK');
    if (opts.minNodes <= 0) throw new Error('FED_INVALID_MIN_NODES');

    const available = this.listNodes().filter((n) => {
      const br = this.breakers.get(n.id);
      return n.healthy && br !== undefined && !br.open;
    });
    if (available.length < opts.minNodes) {
      throw new Error(`FED_INSUFFICIENT_NODES: have=${available.length} need=${opts.minNodes}`);
    }

    const resultsByNode = new Map<string, FederatedResult[]>();
    let successCount = 0;
    const failedNodes: string[] = [];

    await Promise.all(
      available.map(async (node) => {
        const fn = this.searchFns.get(node.id);
        if (!fn) return;
        try {
          const res = await this.runWithTimeout(fn(query, opts.topK), opts.timeoutMs);
          resultsByNode.set(node.id, res);
          successCount += 1;
          this.recordBreaker(node.id, true);
        } catch {
          failedNodes.push(node.id);
          this.recordBreaker(node.id, false);
        }
      }),
    );

    if (failedNodes.length > 0) {
      this.audit('PARTIAL_FAILURE', undefined, `failed=${failedNodes.join(',')}`);
    }

    if (successCount < opts.minNodes) {
      throw new Error(
        `FED_INSUFFICIENT_SUCCESS: success=${successCount} need=${opts.minNodes}`,
      );
    }

    const merged = this.rrfMerge(resultsByNode, opts.topK);
    this.audit('SEARCH', undefined, `q_len=${query.length} k=${opts.topK}`);
    return merged;
  }

  // FR-R60.3: Reciprocal Rank Fusion
  rrfMerge(
    resultsByNode: Map<string, FederatedResult[]>,
    topK: number,
    k = 60,
  ): FederatedResult[] {
    const scores = new Map<string, FederatedResult>();

    for (const [nodeId, results] of resultsByNode.entries()) {
      const node = this.nodes.get(nodeId);
      const weight = node?.weight ?? 1;
      for (let rank = 0; rank < results.length; rank++) {
        const item = results[rank];
        if (!item) continue;
        const rrf = (weight * 1) / (k + rank + 1);
        const prev = scores.get(item.docId);
        if (prev) {
          scores.set(item.docId, { ...prev, score: prev.score + rrf });
        } else {
          scores.set(item.docId, { ...item, score: rrf });
        }
      }
    }

    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // FR-R60.4: 수동 브레이커 트립
  tripBreaker(nodeId: string): void {
    const br = this.breakers.get(nodeId);
    if (!br) throw new Error('FED_UNKNOWN_NODE');
    br.open = true;
    this.audit('BREAKER_OPEN', nodeId);
  }

  resetBreaker(nodeId: string): void {
    const br = this.breakers.get(nodeId);
    if (!br) return;
    br.failCount = 0;
    br.totalCount = 0;
    br.open = false;
  }

  getBreakerState(nodeId: string): BreakerState | undefined {
    const br = this.breakers.get(nodeId);
    return br ? { ...br } : undefined;
  }

  // FR-R60.5
  getAuditLog(limit?: number): FederatedAuditEntry[] {
    const copy = this.auditLog.map((e) => ({ ...e }));
    if (limit !== undefined && limit > 0) return copy.slice(-limit);
    return copy;
  }

  // ── 내부 ───────────────────────────────────────────────────────────────────

  private async runWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('FED_TIMEOUT')), ms);
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e instanceof Error ? e : new Error(String(e)));
        },
      );
    });
  }

  private recordBreaker(nodeId: string, ok: boolean): void {
    const br = this.breakers.get(nodeId);
    if (!br) return;
    br.totalCount = Math.min(BREAKER_WINDOW, br.totalCount + 1);
    if (!ok) {
      br.failCount = Math.min(BREAKER_WINDOW, br.failCount + 1);
    } else {
      br.failCount = Math.max(0, br.failCount - 1);
    }
    if (br.totalCount >= 4 && br.failCount / br.totalCount >= BREAKER_FAIL_RATIO) {
      if (!br.open) {
        br.open = true;
        this.audit('BREAKER_OPEN', nodeId, `ratio=${br.failCount}/${br.totalCount}`);
      }
    }
  }

  private audit(
    action: FederatedAuditEntry['action'],
    nodeId?: string,
    detail?: string,
  ): void {
    const entry: FederatedAuditEntry = {
      timestamp: new Date().toISOString(),
      action,
    };
    if (nodeId !== undefined) entry.nodeId = nodeId;
    if (detail !== undefined) entry.detail = detail;
    this.auditLog.push(entry);
  }
}
