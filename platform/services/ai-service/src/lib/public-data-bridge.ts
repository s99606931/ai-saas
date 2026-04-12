/**
 * 공공 데이터 연계 브릿지 — SVC-AI-ADV-R155
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R155/SVC-AI-ADV-R155.design.md
 * Plan SC: FR-R155.1 ~ FR-R155.5
 *
 * 공공 API 엔드포인트 등록 + 데이터 패치 + 응답 정규화.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface FieldMapping {
  from: string
  to: string
  transform?: 'string' | 'number' | 'boolean'
}

export interface EndpointConfig {
  id: string
  url: string
  mappings: FieldMapping[]
  retries?: number
  timeoutMs?: number
}

export type FetchFn = (url: string) => Promise<unknown>

export interface BridgeResult {
  endpointId: string
  raw: unknown
  normalized: Record<string, unknown>[]
  fetchedAt: number
}

export interface BridgeAuditEntry {
  action: 'endpointRegistered' | 'fetched' | 'normalized' | 'error'
  endpointId: string
  timestamp: number
  details: Record<string, unknown>
}

export class PublicDataBridge {
  private readonly endpoints = new Map<string, EndpointConfig>()
  private readonly auditLog: BridgeAuditEntry[] = []
  private readonly fetchFn: FetchFn

  constructor(grade: DataGrade, fetchFn?: FetchFn) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 공공 데이터 브릿지 사용 금지 (N2SF N-05)`,
      )
    }
    this.fetchFn = fetchFn ?? this.defaultFetch
  }

  /** FR-R155.1 */
  registerEndpoint(cfg: EndpointConfig): void {
    if (!cfg.id.trim()) throw new Error('endpoint id must not be empty')
    if (!cfg.url.trim()) throw new Error('endpoint url must not be empty')
    this.endpoints.set(cfg.id, { ...cfg })
    this.audit('endpointRegistered', cfg.id, { url: cfg.url, mappings: cfg.mappings.length })
  }

  /** FR-R155.2 ~ FR-R155.4 */
  async fetch(endpointId: string): Promise<BridgeResult> {
    const cfg = this.endpoints.get(endpointId)
    if (!cfg) throw new Error(`unknown endpoint: ${endpointId}`)

    const retries = cfg.retries ?? 2
    let raw: unknown
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        raw = await this.fetchFn(cfg.url)
        lastError = null
        break
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        if (attempt < retries) continue
      }
    }

    if (lastError) {
      this.audit('error', endpointId, { error: lastError.message })
      throw lastError
    }

    this.audit('fetched', endpointId, { url: cfg.url })

    const normalized = this.normalize(raw, cfg.mappings)
    this.audit('normalized', endpointId, { count: normalized.length })

    return {
      endpointId,
      raw,
      normalized,
      fetchedAt: Date.now(),
    }
  }

  /** FR-R155.5 */
  getAuditLog(): readonly BridgeAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private normalize(raw: unknown, mappings: FieldMapping[]): Record<string, unknown>[] {
    const items = Array.isArray(raw) ? raw : [raw]
    return items.map((item) => {
      const record: Record<string, unknown> = {}
      const obj = (item && typeof item === 'object') ? item as Record<string, unknown> : {}
      for (const mapping of mappings) {
        let value = obj[mapping.from]
        if (value !== undefined) {
          value = this.applyTransform(value, mapping.transform)
          value = typeof value === 'string' ? this.maskPII(value) : value
        }
        record[mapping.to] = value ?? null
      }
      return record
    })
  }

  private applyTransform(value: unknown, transform?: 'string' | 'number' | 'boolean'): unknown {
    if (!transform) return value
    if (transform === 'string') return String(value ?? '')
    if (transform === 'number') return Number(value)
    if (transform === 'boolean') return Boolean(value)
    return value
  }

  private maskPII(text: string): string {
    return text
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
      .replace(/\b\d{6}-\d{7}\b/g, '[RRN]')
      .replace(/\b010-\d{4}-\d{4}\b/g, '[PHONE]')
  }

  private async defaultFetch(url: string): Promise<unknown> {
    throw new Error(`fetchFn not injected, cannot fetch: ${url}`)
  }

  private audit(
    action: BridgeAuditEntry['action'],
    endpointId: string,
    details: Record<string, unknown>,
  ): void {
    this.auditLog.push({ action, endpointId, timestamp: Date.now(), details })
  }
}
