// Design Ref: §R251 — AI기반 지능형 캐시 최적화
// Plan SC: SVC-AI-ADV-R251-SC01
// CSAP D-06: 감사 로그, D-12: 입력 검증

export type CacheStrategy = 'LRU' | 'LFU' | 'TTL' | 'WRITE_THROUGH' | 'WRITE_BACK'
export type CacheAction = 'INCREASE_TTL' | 'DECREASE_TTL' | 'CHANGE_STRATEGY' | 'INCREASE_SIZE' | 'NO_CHANGE'

export interface CacheConfig {
  cacheId: string
  name: string
  currentStrategy: CacheStrategy
  maxSizeMb: number
  defaultTtlSeconds: number
}

export interface CacheMetric {
  cacheId: string
  timestamp: number
  hitCount: number
  missCount: number
  evictionCount: number
  usedSizeMb: number
}

export interface CacheOptimization {
  cacheId: string
  action: CacheAction
  currentHitRate: number
  recommendedStrategy: CacheStrategy
  recommendedTtlSeconds: number
  recommendedSizeMb: number
  reason: string
}

interface AuditEntry {
  timestamp: string
  action: string
  cacheId: string
  detail: Record<string, unknown>
}

const LOW_HIT_RATE = 0.5
const HIGH_EVICTION_RATE = 0.3

export class IntelligentCacheOptimizerAi {
  private caches = new Map<string, CacheConfig>()
  private metrics = new Map<string, CacheMetric[]>()
  private auditLog: AuditEntry[] = []

  registerCache(config: CacheConfig): void {
    this.caches.set(config.cacheId, config)
    this.metrics.set(config.cacheId, [])
    this.appendAudit('cache.register', config.cacheId, { name: config.name, strategy: config.currentStrategy })
  }

  recordMetric(metric: CacheMetric): void {
    if (!this.caches.has(metric.cacheId)) throw new Error(`Unknown cache: ${metric.cacheId}`)
    const list = this.metrics.get(metric.cacheId) ?? []
    list.push(metric)
    this.metrics.set(metric.cacheId, list)
  }

  optimize(cacheId: string): CacheOptimization {
    const config = this.caches.get(cacheId)
    if (!config) throw new Error(`Unknown cache: ${cacheId}`)

    const history = this.metrics.get(cacheId) ?? []
    if (history.length === 0) {
      return {
        cacheId,
        action: 'NO_CHANGE',
        currentHitRate: 0,
        recommendedStrategy: config.currentStrategy,
        recommendedTtlSeconds: config.defaultTtlSeconds,
        recommendedSizeMb: config.maxSizeMb,
        reason: '메트릭 데이터 없음',
      }
    }

    const recent = history.slice(-5)
    const totalHits = recent.reduce((s, m) => s + m.hitCount, 0)
    const totalMisses = recent.reduce((s, m) => s + m.missCount, 0)
    const totalEvictions = recent.reduce((s, m) => s + m.evictionCount, 0)
    const avgUsedSizeMb = recent.reduce((s, m) => s + m.usedSizeMb, 0) / recent.length

    const hitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0
    const evictionRate = totalHits + totalMisses > 0 ? totalEvictions / (totalHits + totalMisses) : 0
    const sizeUtilization = avgUsedSizeMb / config.maxSizeMb

    let action: CacheAction = 'NO_CHANGE'
    let recommendedStrategy = config.currentStrategy
    let recommendedTtlSeconds = config.defaultTtlSeconds
    let recommendedSizeMb = config.maxSizeMb
    let reason = '캐시 상태 정상'

    if (evictionRate > HIGH_EVICTION_RATE && sizeUtilization > 0.9) {
      action = 'INCREASE_SIZE'
      recommendedSizeMb = config.maxSizeMb * 2
      reason = `높은 축출률 ${Math.round(evictionRate * 100)}% + 용량 포화 — 캐시 크기 2배 증가 권고`
    } else if (hitRate < LOW_HIT_RATE) {
      if (config.currentStrategy === 'LRU') {
        action = 'CHANGE_STRATEGY'
        recommendedStrategy = 'LFU'
        reason = `낮은 히트율 ${Math.round(hitRate * 100)}% — LRU에서 LFU로 전략 변경 권고`
      } else {
        action = 'INCREASE_TTL'
        recommendedTtlSeconds = config.defaultTtlSeconds * 2
        reason = `낮은 히트율 ${Math.round(hitRate * 100)}% — TTL 연장 권고`
      }
    } else if (hitRate > 0.9 && sizeUtilization < 0.3) {
      action = 'DECREASE_TTL'
      recommendedTtlSeconds = Math.max(60, Math.round(config.defaultTtlSeconds * 0.5))
      reason = `높은 히트율 + 낮은 사용률 — TTL 단축으로 메모리 최적화 권고`
    }

    this.appendAudit('cache.optimize', cacheId, { action, hitRate: Math.round(hitRate * 100) / 100, recommendedStrategy })

    return {
      cacheId,
      action,
      currentHitRate: Math.round(hitRate * 100) / 100,
      recommendedStrategy,
      recommendedTtlSeconds,
      recommendedSizeMb,
      reason,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, cacheId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, cacheId, detail })
  }
}
