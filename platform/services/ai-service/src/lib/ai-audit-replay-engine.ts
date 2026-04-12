/**
 * AI Audit Replay Engine — SVC-AI-ADV-R132
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R132.design.md
 * Plan SC: FR-R132.1 ~ FR-R132.7
 *
 * 감사 이벤트 재현 + 타임라인 시각화 데이터 생성.
 * 원본 불변, PII 마스킹, causality 체인 추출.
 * CSAP D-06 감사, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface AuditEvent {
  id: string
  timestamp: number
  actor: string
  action: string
  resource: string
  traceId?: string
  payload?: Record<string, unknown>
}

export interface ReplayFilter {
  from?: number
  to?: number
  actor?: string
  action?: string
  resource?: string
  traceId?: string
}

export interface TimelineBucket {
  start: number
  end: number
  count: number
  events: AuditEvent[]
}

export interface CausalityChain {
  traceId: string
  length: number
  events: AuditEvent[]
  durationMs: number
}

export interface VisualizationExport {
  filter: ReplayFilter
  generatedAt: number
  buckets: TimelineBucket[]
  chains: CausalityChain[]
}

export interface ReplayAuditEntry {
  action: 'ingested' | 'replayed' | 'timelineBuilt' | 'causalityTraced' | 'exported'
  timestamp: number
  details: Record<string, unknown>
}

export class AIAuditReplayEngine {
  private readonly events: AuditEvent[] = []
  private readonly idSet = new Set<string>()
  private readonly auditLog: ReplayAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 AI Audit Replay Engine 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R132.1 */
  ingest(event: AuditEvent): void {
    if (!event.id.trim()) throw new Error('event.id must not be empty')
    if (!event.actor.trim()) throw new Error('event.actor must not be empty')
    if (!event.action.trim()) throw new Error('event.action must not be empty')
    if (!event.resource.trim()) throw new Error('event.resource must not be empty')
    if (!Number.isFinite(event.timestamp)) {
      throw new Error('event.timestamp must be finite')
    }
    if (this.idSet.has(event.id)) {
      throw new Error(`duplicate event id: ${event.id}`)
    }

    const copy: AuditEvent = {
      id: event.id,
      timestamp: event.timestamp,
      actor: event.actor,
      action: event.action,
      resource: event.resource,
      traceId: event.traceId,
      payload: event.payload ? { ...event.payload } : undefined,
    }

    // binary insertion by timestamp
    let lo = 0
    let hi = this.events.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const midEvent = this.events[mid]
      if (midEvent && midEvent.timestamp <= copy.timestamp) lo = mid + 1
      else hi = mid
    }
    this.events.splice(lo, 0, copy)
    this.idSet.add(copy.id)

    this.audit({
      action: 'ingested',
      timestamp: Date.now(),
      details: { id: copy.id, actor: copy.actor },
    })
  }

  /** FR-R132.2 */
  replay(filter: ReplayFilter): AuditEvent[] {
    const result: AuditEvent[] = []
    for (const e of this.events) {
      if (filter.from !== undefined && e.timestamp < filter.from) continue
      if (filter.to !== undefined && e.timestamp > filter.to) continue
      if (filter.actor && !e.actor.includes(filter.actor)) continue
      if (filter.action && !e.action.includes(filter.action)) continue
      if (filter.resource && !e.resource.includes(filter.resource)) continue
      if (filter.traceId && e.traceId !== filter.traceId) continue
      result.push(this.maskSensitive(e))
    }
    this.audit({
      action: 'replayed',
      timestamp: Date.now(),
      details: { count: result.length },
    })
    return result
  }

  /** FR-R132.3 */
  buildTimeline(events: AuditEvent[], bucketMs: number): TimelineBucket[] {
    if (bucketMs <= 0) throw new Error('bucketMs must be positive')
    if (events.length === 0) return []
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
    const first = sorted[0]
    if (!first) return []
    const origin = Math.floor(first.timestamp / bucketMs) * bucketMs
    const bucketMap = new Map<number, TimelineBucket>()

    for (const e of sorted) {
      const idx = Math.floor((e.timestamp - origin) / bucketMs)
      const start = origin + idx * bucketMs
      const existing = bucketMap.get(start)
      if (existing) {
        existing.count += 1
        existing.events.push(e)
      } else {
        bucketMap.set(start, {
          start,
          end: start + bucketMs,
          count: 1,
          events: [e],
        })
      }
    }
    const buckets = [...bucketMap.values()].sort((a, b) => a.start - b.start)
    this.audit({
      action: 'timelineBuilt',
      timestamp: Date.now(),
      details: { bucketCount: buckets.length, bucketMs },
    })
    return buckets
  }

  /** FR-R132.4 */
  traceCausality(traceId: string): CausalityChain {
    if (!traceId.trim()) {
      throw new Error('traceId must not be empty')
    }
    const matched = this.events
      .filter((e) => e.traceId === traceId)
      .map((e) => this.maskSensitive(e))
      .sort((a, b) => a.timestamp - b.timestamp)

    const first = matched[0]
    const last = matched[matched.length - 1]
    const durationMs =
      first && last ? last.timestamp - first.timestamp : 0

    const chain: CausalityChain = {
      traceId,
      length: matched.length,
      events: matched,
      durationMs,
    }
    this.audit({
      action: 'causalityTraced',
      timestamp: Date.now(),
      details: { traceId, length: matched.length },
    })
    return chain
  }

  /** FR-R132.5 */
  maskSensitive(event: AuditEvent): AuditEvent {
    return {
      id: event.id,
      timestamp: event.timestamp,
      actor: event.actor,
      action: event.action,
      resource: event.resource,
      traceId: event.traceId,
      payload: event.payload ? this.maskPayload(event.payload) : undefined,
    }
  }

  /** FR-R132.6 */
  exportVisualization(filter: ReplayFilter, bucketMs: number): VisualizationExport {
    const replayed = this.replay(filter)
    const buckets = this.buildTimeline(replayed, bucketMs)
    const traceIds = new Set<string>()
    for (const e of replayed) {
      if (e.traceId) traceIds.add(e.traceId)
    }
    const chains: CausalityChain[] = []
    for (const id of traceIds) chains.push(this.traceCausality(id))

    const exportData: VisualizationExport = JSON.parse(
      JSON.stringify({
        filter,
        generatedAt: Date.now(),
        buckets,
        chains,
      }),
    ) as VisualizationExport

    this.audit({
      action: 'exported',
      timestamp: Date.now(),
      details: {
        bucketCount: buckets.length,
        chainCount: chains.length,
      },
    })
    return exportData
  }

  /** FR-R132.7 */
  getAuditLog(): ReplayAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private maskPayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(payload)) {
      if (this.isSecretKey(k)) {
        out[k] = '[REDACTED]'
      } else if (typeof v === 'string') {
        out[k] = this.maskString(v)
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = this.maskPayload(v as Record<string, unknown>)
      } else {
        out[k] = v
      }
    }
    return out
  }

  private isSecretKey(key: string): boolean {
    const lower = key.toLowerCase()
    return (
      lower.includes('secret') ||
      lower.includes('password') ||
      lower.includes('token') ||
      lower.includes('apikey') ||
      lower.includes('api_key') ||
      lower.includes('credential')
    )
  }

  private maskString(s: string): string {
    return s
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '***@***')
      .replace(/\b\d{6}-\d{7}\b/g, '******-*******')
      .replace(/\b010-\d{4}-\d{4}\b/g, '010-****-****')
  }

  private audit(entry: ReplayAuditEntry): void {
    this.auditLog.push(entry)
  }
}
