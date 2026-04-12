/**
 * Regulation Change Monitor — SVC-AI-ADV-R90
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R90.design.md
 * Plan SC: FR-R90.1 ~ FR-R90.7
 *
 * 공공기관 법령/고시/예규 변경을 자동 탐지하고 서비스 영향도를 LLM으로 분석한다.
 * N2SF O등급 공개 법령 데이터만 처리하므로 AI 전송이 허용된다.
 */

// ============================================================
// Types
// ============================================================

export type RegulationGrade = 'LAW' | 'DECREE' | 'RULE' | 'NOTICE'

export interface RegulationDocument {
  id: string
  title: string
  grade: RegulationGrade
  effectiveDate: string
  bodyHash: string
  url: string
}

export type ChangeType = 'ADDED' | 'MODIFIED' | 'REMOVED'

export interface RegulationChange {
  docId: string
  title: string
  changeType: ChangeType
  prevHash: string | null
  nextHash: string | null
  detectedAt: string
}

export type ImpactLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface ImpactAssessment {
  change: RegulationChange
  level: ImpactLevel
  rationale: string
  affectedServices: string[]
  complianceTags: string[]
}

export interface LedgerEntry {
  id: string
  timestamp: string
  assessment: ImpactAssessment
}

export interface AlertPayload {
  level: ImpactLevel
  title: string
  summary: string
  services: string[]
  tags: string[]
  docUrl: string
}

// ============================================================
// Injection Interfaces
// ============================================================

export interface HttpClient {
  get(url: string, headers?: Record<string, string>): Promise<string>
}

export interface LlmClient {
  /** Plain text prompt → JSON string response. */
  complete(prompt: string): Promise<string>
}

export interface KeyValueStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

export interface AppendOnlyStorage {
  append(entry: LedgerEntry): Promise<void>
  list(): Promise<LedgerEntry[]>
}

export interface AlertChannel {
  name: string
  send(payload: AlertPayload): Promise<void>
}

export interface AuditLogger {
  log(event: string, detail: Record<string, unknown>): Promise<void>
}

// ============================================================
// RegulationPoller — FR-R90.1
// ============================================================

export interface PollerOptions {
  http: HttpClient
  endpoint: string
  apiKey: string
  intervalMs?: number
  maxBackoffMs?: number
  audit: AuditLogger
}

export class RegulationPoller {
  private readonly http: HttpClient
  private readonly endpoint: string
  private readonly apiKey: string
  private readonly intervalMs: number
  private readonly maxBackoffMs: number
  private readonly audit: AuditLogger
  private failures = 0

  constructor(opts: PollerOptions) {
    this.http = opts.http
    this.endpoint = opts.endpoint
    this.apiKey = opts.apiKey
    this.intervalMs = opts.intervalMs ?? 24 * 60 * 60 * 1000
    this.maxBackoffMs = opts.maxBackoffMs ?? 60 * 60 * 1000
    this.audit = opts.audit
  }

  get pollIntervalMs(): number {
    return this.intervalMs
  }

  get currentFailures(): number {
    return this.failures
  }

  async fetchOnce(): Promise<RegulationDocument[]> {
    try {
      const body = await this.http.get(this.endpoint, {
        Authorization: `Bearer ${this.apiKey}`,
      })
      const parsed = this.parse(body)
      this.failures = 0
      await this.audit.log('regulation.poll.success', {
        count: parsed.length,
      })
      return parsed
    } catch (err) {
      this.failures += 1
      await this.audit.log('regulation.poll.failure', {
        failures: this.failures,
        error: (err as Error).message,
      })
      throw err
    }
  }

  backoffMs(): number {
    const base = Math.min(1000 * 2 ** this.failures, this.maxBackoffMs)
    return base
  }

  private parse(body: string): RegulationDocument[] {
    const data = JSON.parse(body) as { items?: unknown[] }
    if (!data.items || !Array.isArray(data.items)) return []
    return data.items
      .map((raw): RegulationDocument | null => {
        const item = raw as Record<string, unknown>
        if (
          typeof item.id !== 'string' ||
          typeof item.title !== 'string' ||
          typeof item.bodyHash !== 'string'
        ) {
          return null
        }
        return {
          id: item.id,
          title: item.title,
          grade: (item.grade as RegulationGrade) ?? 'NOTICE',
          effectiveDate:
            (item.effectiveDate as string) ?? new Date().toISOString(),
          bodyHash: item.bodyHash,
          url: (item.url as string) ?? '',
        }
      })
      .filter((d): d is RegulationDocument => d !== null)
  }
}

// ============================================================
// DiffDetector — FR-R90.2 (pure)
// ============================================================

export class DiffDetector {
  detect(
    previous: RegulationDocument[],
    current: RegulationDocument[],
    now: string = new Date().toISOString(),
  ): RegulationChange[] {
    const prevMap = new Map(previous.map((d) => [d.id, d]))
    const currMap = new Map(current.map((d) => [d.id, d]))
    const changes: RegulationChange[] = []

    for (const curr of current) {
      const prev = prevMap.get(curr.id)
      if (!prev) {
        changes.push({
          docId: curr.id,
          title: curr.title,
          changeType: 'ADDED',
          prevHash: null,
          nextHash: curr.bodyHash,
          detectedAt: now,
        })
      } else if (prev.bodyHash !== curr.bodyHash) {
        changes.push({
          docId: curr.id,
          title: curr.title,
          changeType: 'MODIFIED',
          prevHash: prev.bodyHash,
          nextHash: curr.bodyHash,
          detectedAt: now,
        })
      }
    }

    for (const prev of previous) {
      if (!currMap.has(prev.id)) {
        changes.push({
          docId: prev.id,
          title: prev.title,
          changeType: 'REMOVED',
          prevHash: prev.bodyHash,
          nextHash: null,
          detectedAt: now,
        })
      }
    }

    return changes
  }
}

// ============================================================
// ImpactAnalyzer — FR-R90.3
// ============================================================

export class ImpactAnalyzer {
  constructor(
    private readonly llm: LlmClient,
    private readonly audit: AuditLogger,
  ) {}

  async assess(
    change: RegulationChange,
    context: { snippet: string },
  ): Promise<ImpactAssessment> {
    const prompt = this.buildPrompt(change, context.snippet)
    let level: ImpactLevel = 'LOW'
    let rationale = 'LLM 응답 파싱 실패로 안전 기본값 적용'
    let affectedServices: string[] = []
    let complianceTags: string[] = []

    try {
      const raw = await this.llm.complete(prompt)
      const parsed = JSON.parse(raw) as {
        level?: ImpactLevel
        rationale?: string
        affectedServices?: string[]
        complianceTags?: string[]
      }
      if (parsed.level && this.isValidLevel(parsed.level)) {
        level = parsed.level
      }
      if (typeof parsed.rationale === 'string') {
        rationale = parsed.rationale
      }
      if (Array.isArray(parsed.affectedServices)) {
        affectedServices = parsed.affectedServices.filter(
          (s): s is string => typeof s === 'string',
        )
      }
      if (Array.isArray(parsed.complianceTags)) {
        complianceTags = parsed.complianceTags.filter(
          (s): s is string => typeof s === 'string',
        )
      }
    } catch (err) {
      await this.audit.log('regulation.impact.parse_error', {
        docId: change.docId,
        error: (err as Error).message,
      })
    }

    return {
      change,
      level,
      rationale,
      affectedServices,
      complianceTags,
    }
  }

  private isValidLevel(value: string): value is ImpactLevel {
    return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(value)
  }

  private buildPrompt(change: RegulationChange, snippet: string): string {
    return [
      '당신은 공공기관 규제 영향도 분석 전문가입니다.',
      '다음 법령 변경의 서비스 영향도를 분석하여 JSON만 반환하세요.',
      `변경 유형: ${change.changeType}`,
      `법령 제목: ${change.title}`,
      `요약(공개 법령, O등급): ${snippet}`,
      '출력 형식:',
      '{"level":"CRITICAL|HIGH|MEDIUM|LOW","rationale":"...",',
      '"affectedServices":["..."],"complianceTags":["CSAP-D08",...]}',
    ].join('\n')
  }
}

// ============================================================
// ServiceMapper — FR-R90.4 (pure)
// ============================================================

export interface ServiceMapping {
  keyword: string
  service: string
}

export class ServiceMapper {
  constructor(private readonly mappings: ServiceMapping[]) {}

  map(text: string): string[] {
    const hits = new Set<string>()
    const lower = text.toLowerCase()
    for (const { keyword, service } of this.mappings) {
      if (lower.includes(keyword.toLowerCase())) {
        hits.add(service)
      }
    }
    return [...hits]
  }

  merge(
    llmServices: string[],
    keywordServices: string[],
  ): string[] {
    return [...new Set([...llmServices, ...keywordServices])]
  }
}

// ============================================================
// ChangeLedger — FR-R90.6 (append-only, CSAP D-06)
// ============================================================

export class ChangeLedger {
  constructor(private readonly storage: AppendOnlyStorage) {}

  async record(assessment: ImpactAssessment): Promise<LedgerEntry> {
    const entry: LedgerEntry = {
      id: `reg-${assessment.change.docId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      assessment,
    }
    await this.storage.append(entry)
    return entry
  }

  async history(): Promise<LedgerEntry[]> {
    return this.storage.list()
  }
}

// ============================================================
// AlertRouter — FR-R90.5
// ============================================================

export class AlertRouter {
  constructor(
    private readonly channels: AlertChannel[],
    private readonly audit: AuditLogger,
  ) {}

  async dispatch(assessment: ImpactAssessment): Promise<void> {
    if (this.channels.length === 0) return
    const payload: AlertPayload = {
      level: assessment.level,
      title: assessment.change.title,
      summary: assessment.rationale,
      services: assessment.affectedServices,
      tags: assessment.complianceTags,
      docUrl: '',
    }
    const errors: string[] = []
    for (const ch of this.channels) {
      try {
        await ch.send(payload)
      } catch (err) {
        errors.push(`${ch.name}:${(err as Error).message}`)
      }
    }
    await this.audit.log('regulation.alert.dispatch', {
      level: assessment.level,
      channels: this.channels.map((c) => c.name),
      errors,
    })
  }
}

// ============================================================
// RegulationChangeMonitor — Orchestrator
// ============================================================

export interface MonitorOptions {
  poller: RegulationPoller
  detector: DiffDetector
  analyzer: ImpactAnalyzer
  mapper: ServiceMapper
  ledger: ChangeLedger
  router: AlertRouter
  snapshotStore: KeyValueStore
  audit: AuditLogger
}

export class RegulationChangeMonitor {
  constructor(private readonly opts: MonitorOptions) {}

  async runCycle(snippetResolver: (id: string) => Promise<string>): Promise<{
    changes: RegulationChange[]
    assessments: ImpactAssessment[]
  }> {
    const current = await this.opts.poller.fetchOnce()
    const prev = await this.loadSnapshot()
    const changes = this.opts.detector.detect(prev, current)
    const assessments: ImpactAssessment[] = []

    for (const change of changes) {
      const snippet = await snippetResolver(change.docId)
      const assessment = await this.opts.analyzer.assess(change, { snippet })
      const mapped = this.opts.mapper.map(`${change.title} ${snippet}`)
      assessment.affectedServices = this.opts.mapper.merge(
        assessment.affectedServices,
        mapped,
      )
      await this.opts.ledger.record(assessment)
      await this.opts.router.dispatch(assessment)
      assessments.push(assessment)
    }

    await this.saveSnapshot(current)
    await this.opts.audit.log('regulation.cycle.complete', {
      changes: changes.length,
    })
    return { changes, assessments }
  }

  async exportSnapshot(): Promise<RegulationDocument[]> {
    return this.loadSnapshot()
  }

  private async loadSnapshot(): Promise<RegulationDocument[]> {
    const raw = await this.opts.snapshotStore.get('regulation:snapshot')
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as RegulationDocument[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private async saveSnapshot(
    docs: RegulationDocument[],
  ): Promise<void> {
    await this.opts.snapshotStore.set(
      'regulation:snapshot',
      JSON.stringify(docs),
    )
  }
}
