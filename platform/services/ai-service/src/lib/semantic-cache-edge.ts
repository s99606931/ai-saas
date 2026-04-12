// 시맨틱 캐시 고도화 (엣지 AI) -- FR-N380.1~FR-N380.5
// Design Ref: MTU-N380 | CSAP: D-06, D-08

export interface CacheEntry {
  readonly key: string;
  readonly tenantId: string;
  readonly embedding: readonly number[];
  readonly prompt: string;
  readonly response: string;
  readonly createdAt: number;
  lastAccessedAt: number;
  hits: number;
}

export interface CacheStats {
  readonly size: number;
  readonly hits: number;
  readonly misses: number;
  readonly hitRate: number;
  readonly evictions: number;
}

export interface SemCacheAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const cache = new Map<string, CacheEntry>();
const auditLog: SemCacheAuditEntry[] = [];
let totalHits = 0;
let totalMisses = 0;
let totalEvictions = 0;

function recordAudit(entry: Omit<SemCacheAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getSemCacheAuditLog(tenantId: string): readonly SemCacheAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function cacheSet(tenantId: string, prompt: string, embedding: readonly number[], response: string): string {
  const key = `${tenantId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  cache.set(key, {
    key,
    tenantId,
    embedding,
    prompt,
    response,
    createdAt: now,
    lastAccessedAt: now,
    hits: 0,
  });
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'CACHE_SET',
    target: key,
    details: { promptLen: prompt.length },
  });
  return key;
}

export function cacheGet(
  tenantId: string,
  queryEmbedding: readonly number[],
  threshold = 0.92,
): CacheEntry | undefined {
  let best: { entry: CacheEntry; sim: number } | undefined;
  for (const entry of cache.values()) {
    if (entry.tenantId !== tenantId) continue; // 테넌트 격리
    const sim = cosineSimilarity(queryEmbedding, entry.embedding);
    if (sim >= threshold && (!best || sim > best.sim)) {
      best = { entry, sim };
    }
  }
  if (best) {
    best.entry.lastAccessedAt = Date.now();
    best.entry.hits += 1;
    totalHits += 1;
    recordAudit({
      actor: 'system',
      tenantId,
      action: 'CACHE_HIT',
      target: best.entry.key,
      details: { similarity: best.sim },
    });
    return best.entry;
  }
  totalMisses += 1;
  return undefined;
}

export function evictLRU(maxSize: number): number {
  if (cache.size <= maxSize) return 0;
  const entries = Array.from(cache.values()).sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
  const toEvict = cache.size - maxSize;
  for (let i = 0; i < toEvict; i++) {
    const e = entries[i];
    if (e) cache.delete(e.key);
  }
  totalEvictions += toEvict;
  return toEvict;
}

export function getCacheStats(): CacheStats {
  const total = totalHits + totalMisses;
  return {
    size: cache.size,
    hits: totalHits,
    misses: totalMisses,
    hitRate: total > 0 ? totalHits / total : 0,
    evictions: totalEvictions,
  };
}

export function clearTenantCache(tenantId: string): number {
  let count = 0;
  for (const [key, entry] of cache.entries()) {
    if (entry.tenantId === tenantId) {
      cache.delete(key);
      count += 1;
    }
  }
  return count;
}

export class SemanticCacheEdgeService {
  constructor(
    private readonly tenantId: string,
    private readonly threshold = 0.92,
  ) {}
  set(prompt: string, embedding: readonly number[], response: string): string {
    return cacheSet(this.tenantId, prompt, embedding, response);
  }
  get(queryEmbedding: readonly number[]): CacheEntry | undefined {
    return cacheGet(this.tenantId, queryEmbedding, this.threshold);
  }
  evict(maxSize: number): number {
    return evictLRU(maxSize);
  }
  stats(): CacheStats {
    return getCacheStats();
  }
  clearMyTenant(): number {
    return clearTenantCache(this.tenantId);
  }
  getAuditLog(): readonly SemCacheAuditEntry[] {
    return getSemCacheAuditLog(this.tenantId);
  }
}
