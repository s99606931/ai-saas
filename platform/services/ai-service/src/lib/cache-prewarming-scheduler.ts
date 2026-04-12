/**
 * Cache Prewarming Scheduler — SVC-AI-ADV-R109
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R109.design.md
 * Plan SC: FR-R109.1 ~ FR-R109.5
 *
 * 과거 접근 패턴 분석 기반 캐시 프리워밍 스케줄 생성.
 */

export interface AccessEvent {
  resourceId: string
  timestamp: number
}

export interface PrewarmEntry {
  triggerIso: string
  hour: number
  resources: string[]
}

export interface PlanOptions {
  topN: number
  leadMinutes: number
  baseDay: Date
}

export class CachePrewarmingScheduler {
  /**
   * FR-R109.1~4: 이벤트 분석 + 스케줄 생성.
   */
  plan(events: AccessEvent[], opts: PlanOptions): PrewarmEntry[] {
    if (events.length === 0) return []

    // (dow, hour) 버킷별 리소스 카운트
    const buckets = new Map<string, Map<string, number>>()
    for (const ev of events) {
      const d = new Date(ev.timestamp)
      const key = `${d.getUTCDay()}-${d.getUTCHours()}`
      const inner = buckets.get(key) ?? new Map<string, number>()
      inner.set(ev.resourceId, (inner.get(ev.resourceId) ?? 0) + 1)
      buckets.set(key, inner)
    }

    const entries: PrewarmEntry[] = []
    const base = new Date(
      Date.UTC(
        opts.baseDay.getUTCFullYear(),
        opts.baseDay.getUTCMonth(),
        opts.baseDay.getUTCDate(),
        0,
        0,
        0,
      ),
    )

    for (const [key, inner] of buckets) {
      const [, hourStr] = key.split('-')
      const hour = Number.parseInt(hourStr!, 10)
      const top = Array.from(inner.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, opts.topN)
        .map(([resourceId]) => resourceId)

      const bucketStart = new Date(base)
      bucketStart.setUTCHours(hour, 0, 0, 0)
      const trigger = new Date(
        bucketStart.getTime() - opts.leadMinutes * 60_000,
      )

      entries.push({
        triggerIso: trigger.toISOString(),
        hour,
        resources: Array.from(new Set(top)),
      })
    }

    entries.sort((a, b) => a.hour - b.hour)
    return entries
  }
}
