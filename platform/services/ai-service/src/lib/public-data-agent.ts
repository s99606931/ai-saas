// SVC-AI-ADV-R49: 공공데이터 연계 에이전트
// Design Ref: §모듈, §흐름, §인터페이스
// Plan SC: FR-R49.1, FR-R49.3

import { createHash } from 'crypto'
import { PublicAPICollector, type InferredSchema } from './public-api-collector'

export interface PublicEndpoint {
  id: string
  name: string
  url: string
  apiKeyEnv: string            // 환경 변수 이름 (하드코딩 금지)
  incrementalParam?: string    // 증분 파라미터명 (예: 'sinceDate')
  license: string              // 이용 조건 (CC-BY, 공공누리 등)
  gradeAllowed: 'O'            // 공공 API는 O등급만 허용
}

export interface CollectOptions {
  maxRecords?: number
  since?: Date
  dedupe?: boolean
}

export interface CollectionResult {
  endpointId: string
  fetched: number
  validated: number
  cleaned: number
  deduped: number
  lastCollectedAt: Date
  schema?: InferredSchema
  issues: number
}

type Fetcher = (url: string, headers: Record<string, string>) => Promise<unknown[]>

/**
 * 공공데이터 연계 에이전트.
 * 카탈로그 기반 주기적 수집 + 증분 처리 + 중복 제거.
 */
export class PublicDataAgent {
  private readonly endpoints: Map<string, PublicEndpoint> = new Map()
  private readonly collector: PublicAPICollector
  private readonly fetcher: Fetcher
  private readonly lastCollected: Map<string, Date> = new Map()
  private readonly seenHashes: Map<string, Set<string>> = new Map()

  constructor(options: {
    collector?: PublicAPICollector
    fetcher: Fetcher
  }) {
    this.collector = options.collector ?? new PublicAPICollector()
    this.fetcher = options.fetcher
  }

  /**
   * 엔드포인트 등록.
   */
  registerEndpoint(endpoint: PublicEndpoint): void {
    if (!endpoint.id || !endpoint.url) {
      throw new Error('endpoint id and url required')
    }
    if (endpoint.gradeAllowed !== 'O') {
      throw new Error('BLOCKED: 공공 API는 O등급만 허용됩니다')
    }
    // 하드코딩 금지 검증 — apiKeyEnv는 환경 변수 이름이어야 함
    if (endpoint.apiKeyEnv.startsWith('sk-') || endpoint.apiKeyEnv.length > 50) {
      throw new Error('BLOCKED: apiKeyEnv는 환경 변수 이름이어야 합니다 (직접 키 금지)')
    }
    this.endpoints.set(endpoint.id, endpoint)
    this.seenHashes.set(endpoint.id, new Set())
  }

  /**
   * 단일 엔드포인트 수집.
   */
  async collect(endpointId: string, opts: CollectOptions = {}): Promise<CollectionResult> {
    const endpoint = this.endpoints.get(endpointId)
    if (!endpoint) {
      throw new Error(`endpoint not found: ${endpointId}`)
    }

    const apiKey = process.env[endpoint.apiKeyEnv] ?? ''
    if (!apiKey) {
      throw new Error(`${endpoint.apiKeyEnv} 환경 변수 누락`)
    }

    const headers: Record<string, string> = { 'X-API-Key': apiKey }
    const url = this.buildUrl(endpoint, opts)

    // 1) Fetch
    const raw = await this.fetcher(url, headers)
    const fetched = raw.length

    // 2) Infer schema
    const schema = this.collector.inferSchema(raw.slice(0, 100))

    // 3) Validate
    const validation = this.collector.validate(raw, schema)

    // 4) Clean
    const cleaned = this.collector.clean(raw)

    // 5) Dedupe
    let deduped = cleaned
    if (opts.dedupe !== false) {
      deduped = this.dedupeRecords(endpointId, cleaned)
    }

    // 6) Limit
    const limited = opts.maxRecords ? deduped.slice(0, opts.maxRecords) : deduped

    // 7) 마지막 수집 시각 기록
    const now = new Date()
    this.lastCollected.set(endpointId, now)

    return {
      endpointId,
      fetched,
      validated: validation.validRecords,
      cleaned: cleaned.length,
      deduped: limited.length,
      lastCollectedAt: now,
      schema,
      issues: validation.issues.length,
    }
  }

  /**
   * 모든 엔드포인트 주기적 수집 (핸들 반환).
   */
  scheduleAll(intervalMs: number): { stop: () => void } {
    if (intervalMs < 1000) {
      throw new Error('interval too short (min 1000ms)')
    }
    const timer = setInterval(() => {
      for (const id of this.endpoints.keys()) {
        this.collect(id).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[PublicDataAgent] collect failed for ${id}: ${msg}`)
        })
      }
    }, intervalMs)

    return {
      stop: () => clearInterval(timer),
    }
  }

  /**
   * 카탈로그 조회.
   */
  listEndpoints(): PublicEndpoint[] {
    return Array.from(this.endpoints.values())
  }

  private buildUrl(endpoint: PublicEndpoint, opts: CollectOptions): string {
    const url = new URL(endpoint.url)
    if (endpoint.incrementalParam) {
      const since = opts.since ?? this.lastCollected.get(endpoint.id)
      if (since) {
        url.searchParams.set(endpoint.incrementalParam, since.toISOString())
      }
    }
    return url.toString()
  }

  private dedupeRecords(endpointId: string, records: unknown[]): unknown[] {
    const seen = this.seenHashes.get(endpointId) ?? new Set<string>()
    const unique: unknown[] = []
    for (const record of records) {
      const hash = createHash('sha256').update(JSON.stringify(record)).digest('hex').substring(0, 16)
      if (!seen.has(hash)) {
        seen.add(hash)
        unique.push(record)
      }
    }
    this.seenHashes.set(endpointId, seen)
    return unique
  }
}

export function createPublicDataAgent(options: ConstructorParameters<typeof PublicDataAgent>[0]): PublicDataAgent {
  return new PublicDataAgent(options)
}
