/**
 * Semantic Embedding Cache — SVC-AI-ADV-R159
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R159.design.md
 * Plan SC: FR-R159.1 ~ FR-R159.8
 *
 * 유사 쿼리의 임베딩을 캐시하여 LLM 호출 비용을 절감한다.
 * 테넌트별 격리, 코사인 유사도 임계값 기반 조회, LRU + TTL 이중 만료.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface CacheEntry {
  key: string
  embedding: number[]
  value: unknown
  createdAt: number
  lastAccess: number
}

export interface CacheStats {
  hits: number
  misses: number
  size: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface CacheOptions {
  maxEntries?: number
  ttlMs?: number
  now?: () => number
}

export class SemanticEmbeddingCache {
  private readonly store: Map<string, CacheEntry[]> = new Map()
  private readonly auditLog: AuditEntry[] = []
  private readonly maxEntries: number
  private readonly ttlMs: number
  private readonly now: () => number
  private hits = 0
  private misses = 0
  private keySeq = 0

  constructor(opts: CacheOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 1000
    this.ttlMs = opts.ttlMs ?? 60 * 60 * 1000
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R159.2: 캐시 저장 */
  set(tenantId: string, embedding: number[], value: unknown, grade: DataGrade = 'O'): string {
    this.assertGrade(grade)
    this.assertTenant(tenantId)
    this.assertEmbedding(embedding)

    this.evictExpired(tenantId)

    const list = this.store.get(tenantId) ?? []
    const now = this.now()
    const key = `${tenantId}-${this.keySeq++}`
    const entry: CacheEntry = {
      key,
      embedding: [...embedding],
      value,
      createdAt: now,
      lastAccess: now,
    }
    list.push(entry)

    if (list.length > this.maxEntries) {
      list.sort((a, b) => a.lastAccess - b.lastAccess)
      const removed = list.shift()
      if (removed) {
        this.audit('evicted_lru', { tenantId, key: removed.key })
      }
    }

    this.store.set(tenantId, list)
    this.audit('set', { tenantId, key })
    return key
  }

  /** FR-R159.3: 캐시 조회 */
  get(
    tenantId: string,
    embedding: number[],
    threshold = 0.92,
  ): { value: unknown; similarity: number } | null {
    this.assertTenant(tenantId)
    this.assertEmbedding(embedding)

    this.evictExpired(tenantId)
    const list = this.store.get(tenantId) ?? []

    let best: { entry: CacheEntry; similarity: number } | null = null
    for (const entry of list) {
      if (entry.embedding.length !== embedding.length) {
        throw new Error('vector_length_mismatch')
      }
      const sim = cosine(entry.embedding, embedding)
      if (!best || sim > best.similarity) {
        best = { entry, similarity: sim }
      }
    }

    if (best && best.similarity >= threshold) {
      best.entry.lastAccess = this.now()
      this.hits += 1
      this.audit('hit', { tenantId, similarity: best.similarity, key: best.entry.key })
      return { value: best.entry.value, similarity: best.similarity }
    }

    this.misses += 1
    this.audit('miss', { tenantId, similarity: best?.similarity ?? 0 })
    return null
  }

  getStats(): CacheStats {
    let size = 0
    for (const list of this.store.values()) size += list.length
    return { hits: this.hits, misses: this.misses, size }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private evictExpired(tenantId: string): void {
    const list = this.store.get(tenantId)
    if (!list) return
    const now = this.now()
    const alive = list.filter((e) => now - e.createdAt < this.ttlMs)
    if (alive.length !== list.length) {
      this.audit('evicted_expired', {
        tenantId,
        removed: list.length - alive.length,
      })
    }
    this.store.set(tenantId, alive)
  }

  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private assertTenant(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('invalid_tenant')
    }
  }

  private assertEmbedding(embedding: number[]): void {
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('invalid_embedding')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0
    const bi = b[i] ?? 0
    dot += ai * bi
    magA += ai * ai
    magB += bi * bi
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  if (denom === 0) return 0
  return dot / denom
}
