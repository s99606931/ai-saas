// Design Ref: §R354 — AI기반 서비스 가속화 캐시
// Plan SC: SC-R354

export interface CachePolicy {
  cacheId: string
  serviceId: string
  routePattern: string
  ttlSeconds: number
  maxEntries: number
  dataGrade: 'C' | 'S' | 'O'
}

export interface CacheAccessRequest {
  cacheId: string
  key: string
  method: 'GET' | 'SET' | 'INVALIDATE'
  value?: string
}

export type CacheResult = 'HIT' | 'MISS' | 'SET' | 'INVALIDATED' | 'BLOCKED_DATA_GRADE'

export interface CacheResponse {
  cacheId: string
  key: string
  result: CacheResult
  value?: string
  hitRate: number
}

interface CacheEntry {
  value: string
  expiresAt: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServiceAccelerationCacheAi {
  private policies = new Map<string, CachePolicy>()
  private store = new Map<string, Map<string, CacheEntry>>()
  private stats = new Map<string, { hits: number; misses: number }>()
  private auditLog: AuditEntry[] = []

  registerPolicy(policy: CachePolicy): void {
    // N2SF: C/S 등급 캐싱 차단
    if (policy.dataGrade === 'C' || policy.dataGrade === 'S') {
      throw new Error(`BLOCKED: ${policy.dataGrade}등급 데이터 캐시 금지 (N2SF N-05)`)
    }
    this.policies.set(policy.cacheId, policy)
    this.store.set(policy.cacheId, new Map())
    this.stats.set(policy.cacheId, { hits: 0, misses: 0 })
    this.auditLog.push({ action: 'cache.register', timestamp: new Date().toISOString(), detail: policy.cacheId })
  }

  access(request: CacheAccessRequest): CacheResponse {
    const policy = this.policies.get(request.cacheId)
    if (!policy) throw new Error(`Cache policy not found: ${request.cacheId}`)

    const cacheStore = this.store.get(request.cacheId)!
    const stat = this.stats.get(request.cacheId)!
    const now = Date.now()

    if (request.method === 'INVALIDATE') {
      cacheStore.delete(request.key)
      this.auditLog.push({ action: 'cache.invalidate', timestamp: new Date().toISOString(), detail: `${request.cacheId}:${request.key}` })
      const total = stat.hits + stat.misses
      return { cacheId: request.cacheId, key: request.key, result: 'INVALIDATED', hitRate: total > 0 ? stat.hits / total : 0 }
    }

    if (request.method === 'SET' && request.value !== undefined) {
      // 최대 항목 수 초과 시 가장 오래된 항목 제거
      if (cacheStore.size >= policy.maxEntries) {
        const firstKey = cacheStore.keys().next().value
        if (firstKey) cacheStore.delete(firstKey)
      }
      cacheStore.set(request.key, { value: request.value, expiresAt: now + policy.ttlSeconds * 1000 })
      this.auditLog.push({ action: 'cache.set', timestamp: new Date().toISOString(), detail: `${request.cacheId}:${request.key}` })
      const total = stat.hits + stat.misses
      return { cacheId: request.cacheId, key: request.key, result: 'SET', hitRate: total > 0 ? stat.hits / total : 0 }
    }

    // GET
    const entry = cacheStore.get(request.key)
    if (entry && entry.expiresAt > now) {
      stat.hits++
      const total = stat.hits + stat.misses
      this.auditLog.push({ action: 'cache.hit', timestamp: new Date().toISOString(), detail: `${request.cacheId}:${request.key}` })
      return { cacheId: request.cacheId, key: request.key, result: 'HIT', value: entry.value, hitRate: stat.hits / total }
    }

    // 만료 or 없음
    if (entry) cacheStore.delete(request.key)
    stat.misses++
    const total = stat.hits + stat.misses
    this.auditLog.push({ action: 'cache.miss', timestamp: new Date().toISOString(), detail: `${request.cacheId}:${request.key}` })
    return { cacheId: request.cacheId, key: request.key, result: 'MISS', hitRate: stat.hits / total }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
