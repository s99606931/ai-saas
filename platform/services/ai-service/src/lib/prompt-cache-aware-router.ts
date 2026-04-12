// Prompt Cache-Aware Router — FR-R63.1~R63.6
// Design Ref: SVC-AI-ADV-R63 DESIGN §모듈 구조
// Plan SC: 캐시 hit rate ≥ 60%, 비용 ≥ 40% 절감
// CSAP: D-08 / D-09 / D-06
// N2SF: N-05 등급 차단

import { createHash } from 'node:crypto';

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type DataGrade = 'C' | 'S' | 'O';

export interface CacheNode {
  id: string;
  endpoint: string;
  /** 현재 부하 (요청 수) */
  load: number;
  /** 정상 동작 여부 */
  healthy: boolean;
}

export interface RoutedNode {
  nodeId: string;
  cacheHit: boolean;
  key: string;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  savedTokens: number;
  totalRoutes: number;
}

export interface RouterOpts {
  /** 접두사 토큰 수 (문자 기준 근사) */
  prefixLength: number;
  /** 캐시 TTL (ms) */
  ttlMs: number;
  /** 평균 토큰/요청 절감 추정치 */
  savedTokensPerHit: number;
}

export interface RouterAuditEntry {
  timestamp: string;
  action:
    | 'NODE_REGISTER'
    | 'NODE_UNREGISTER'
    | 'ROUTE_HIT'
    | 'ROUTE_MISS'
    | 'INVALIDATE'
    | 'EVICT_EXPIRED'
    | 'GRADE_BLOCKED';
  nodeId?: string;
  key?: string;
  tenantId?: string;
}

interface CacheEntry {
  nodeId: string;
  createdAt: number;
  lastUsed: number;
}

const DEFAULT_OPTS: RouterOpts = {
  prefixLength: 512,
  ttlMs: 30 * 60 * 1000,
  savedTokensPerHit: 400,
};

// ── PromptCacheAwareRouter ──────────────────────────────────────────────────

export class PromptCacheAwareRouter {
  private readonly nodes = new Map<string, CacheNode>();
  /** key → entry */
  private readonly cache = new Map<string, CacheEntry>();
  private readonly auditLog: RouterAuditEntry[] = [];
  private readonly opts: RouterOpts;
  private hits = 0;
  private misses = 0;

  constructor(opts: Partial<RouterOpts> = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
    if (this.opts.prefixLength <= 0) throw new Error('RC_INVALID_PREFIX');
    if (this.opts.ttlMs <= 0) throw new Error('RC_INVALID_TTL');
  }

  registerNode(node: CacheNode): void {
    if (!node.id) throw new Error('RC_INVALID_NODE');
    this.nodes.set(node.id, { ...node });
    this.audit('NODE_REGISTER', node.id);
  }

  unregisterNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) return;
    this.nodes.delete(nodeId);
    // 해당 노드의 캐시 항목 제거
    for (const [k, v] of this.cache.entries()) {
      if (v.nodeId === nodeId) this.cache.delete(k);
    }
    this.audit('NODE_UNREGISTER', nodeId);
  }

  listNodes(): CacheNode[] {
    return Array.from(this.nodes.values()).map((n) => ({ ...n }));
  }

  // FR-R63.5
  enforceDataGrade(grade: DataGrade, tenantId?: string): void {
    if (grade === 'C' || grade === 'S') {
      this.audit('GRADE_BLOCKED', undefined, undefined, tenantId);
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 프롬프트 캐시 라우터 사용 금지 (N2SF N-05)`,
      );
    }
  }

  // FR-R63.1
  cacheKey(tenantId: string, prompt: string): string {
    if (!tenantId) throw new Error('RC_TENANT_REQUIRED');
    const prefix = prompt.slice(0, this.opts.prefixLength);
    const hash = createHash('sha256').update(prefix).digest('hex').slice(0, 32);
    return `${tenantId}::${hash}`;
  }

  // FR-R63.2: sticky routing
  route(tenantId: string, prompt: string, grade: DataGrade = 'O'): RoutedNode {
    this.enforceDataGrade(grade, tenantId);

    const healthy = this.listNodes().filter((n) => n.healthy);
    if (healthy.length === 0) throw new Error('RC_NO_HEALTHY_NODE');

    const key = this.cacheKey(tenantId, prompt);
    this.evictExpired();

    const existing = this.cache.get(key);
    if (existing && this.nodes.get(existing.nodeId)?.healthy) {
      existing.lastUsed = Date.now();
      this.hits += 1;
      this.audit('ROUTE_HIT', existing.nodeId, key, tenantId);
      return { nodeId: existing.nodeId, cacheHit: true, key };
    }

    // miss → 부하 최소 노드 선택
    const target = healthy.reduce((a, b) => (a.load <= b.load ? a : b));
    const now = Date.now();
    this.cache.set(key, { nodeId: target.id, createdAt: now, lastUsed: now });
    this.misses += 1;
    this.audit('ROUTE_MISS', target.id, key, tenantId);
    return { nodeId: target.id, cacheHit: false, key };
  }

  // FR-R63.3
  invalidate(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) this.audit('INVALIDATE', undefined, key);
    return existed;
  }

  invalidateTenant(tenantId: string): number {
    let count = 0;
    for (const [k] of this.cache.entries()) {
      if (k.startsWith(`${tenantId}::`)) {
        this.cache.delete(k);
        count += 1;
      }
    }
    if (count > 0) this.audit('INVALIDATE', undefined, `tenant:${tenantId}`);
    return count;
  }

  // FR-R63.4
  getMetrics(): CacheMetrics {
    const totalRoutes = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRoutes === 0 ? 0 : this.hits / totalRoutes,
      savedTokens: this.hits * this.opts.savedTokensPerHit,
      totalRoutes,
    };
  }

  // FR-R63.6
  getAuditLog(limit?: number): RouterAuditEntry[] {
    const copy = this.auditLog.map((e) => ({ ...e }));
    if (limit !== undefined && limit > 0) return copy.slice(-limit);
    return copy;
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  // ── 내부 ───────────────────────────────────────────────────────────────────

  private evictExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (now - v.createdAt > this.opts.ttlMs) {
        this.cache.delete(k);
        this.audit('EVICT_EXPIRED', v.nodeId, k);
      }
    }
  }

  private audit(
    action: RouterAuditEntry['action'],
    nodeId?: string,
    key?: string,
    tenantId?: string,
  ): void {
    const entry: RouterAuditEntry = {
      timestamp: new Date().toISOString(),
      action,
    };
    if (nodeId !== undefined) entry.nodeId = nodeId;
    if (key !== undefined) entry.key = key;
    if (tenantId !== undefined) entry.tenantId = tenantId;
    this.auditLog.push(entry);
  }
}
