/**
 * Unit tests for Regulation Change Monitor — SVC-AI-ADV-R90
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R90.design.md
 * Plan SC: FR-R90.1 ~ FR-R90.6
 */

import { describe, it, expect, vi } from 'vitest'
import {
  RegulationPoller,
  DiffDetector,
  ImpactAnalyzer,
  ServiceMapper,
  ChangeLedger,
  AlertRouter,
  RegulationChangeMonitor,
  type RegulationDocument,
  type AuditLogger,
  type HttpClient,
  type LlmClient,
  type AppendOnlyStorage,
  type KeyValueStore,
  type LedgerEntry,
  type AlertChannel,
} from '../regulation-change-monitor'

const makeAudit = (): AuditLogger => ({
  log: vi.fn().mockResolvedValue(undefined),
})

const sampleDoc = (id: string, hash: string): RegulationDocument => ({
  id,
  title: `법령-${id}`,
  grade: 'NOTICE',
  effectiveDate: '2026-04-12T00:00:00Z',
  bodyHash: hash,
  url: 'https://law.go.kr/' + id,
})

describe('SVC-AI-ADV-R90 RegulationPoller', () => {
  it('[FR-R90.1] fetchOnce parses valid payload', async () => {
    const http: HttpClient = {
      get: vi.fn().mockResolvedValue(
        JSON.stringify({
          items: [
            {
              id: 'A1',
              title: '개인정보보호법 시행령',
              grade: 'DECREE',
              effectiveDate: '2026-05-01T00:00:00Z',
              bodyHash: 'hash-1',
              url: 'https://law.go.kr/A1',
            },
          ],
        }),
      ),
    }
    const audit = makeAudit()
    const poller = new RegulationPoller({
      http,
      endpoint: 'https://api.law.go.kr/feed',
      apiKey: 'test-key',
      audit,
    })
    const docs = await poller.fetchOnce()
    expect(docs).toHaveLength(1)
    expect(docs[0]!.id).toBe('A1')
    expect(audit.log).toHaveBeenCalledWith(
      'regulation.poll.success',
      expect.any(Object),
    )
  })

  it('[FR-R90.1] fetchOnce backs off on failure', async () => {
    const http: HttpClient = {
      get: vi.fn().mockRejectedValue(new Error('timeout')),
    }
    const audit = makeAudit()
    const poller = new RegulationPoller({
      http,
      endpoint: 'https://api.law.go.kr/feed',
      apiKey: 'test-key',
      audit,
    })
    await expect(poller.fetchOnce()).rejects.toThrow('timeout')
    expect(poller.currentFailures).toBe(1)
    expect(poller.backoffMs()).toBeGreaterThanOrEqual(1000)
  })
})

describe('SVC-AI-ADV-R90 DiffDetector', () => {
  it('[FR-R90.2] detects ADDED, MODIFIED, REMOVED', () => {
    const detector = new DiffDetector()
    const prev = [sampleDoc('A1', 'h1'), sampleDoc('A2', 'h2')]
    const curr = [sampleDoc('A1', 'h1'), sampleDoc('A2', 'h2-new'), sampleDoc('A3', 'h3')]
    const changes = detector.detect(prev, curr, '2026-04-12T00:00:00Z')
    const types = changes.map((c) => `${c.docId}:${c.changeType}`).sort()
    expect(types).toEqual(['A2:MODIFIED', 'A3:ADDED'])
  })

  it('[FR-R90.2] returns empty array on no change', () => {
    const detector = new DiffDetector()
    const docs = [sampleDoc('A1', 'h1')]
    expect(detector.detect(docs, docs)).toHaveLength(0)
  })
})

describe('SVC-AI-ADV-R90 ImpactAnalyzer', () => {
  it('[FR-R90.3] parses valid LLM response', async () => {
    const llm: LlmClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          level: 'HIGH',
          rationale: '접근통제 영향',
          affectedServices: ['auth-service'],
          complianceTags: ['CSAP-D08'],
        }),
      ),
    }
    const audit = makeAudit()
    const analyzer = new ImpactAnalyzer(llm, audit)
    const result = await analyzer.assess(
      {
        docId: 'A1',
        title: '개인정보보호법',
        changeType: 'MODIFIED',
        prevHash: 'h0',
        nextHash: 'h1',
        detectedAt: '2026-04-12T00:00:00Z',
      },
      { snippet: '공개 요약' },
    )
    expect(result.level).toBe('HIGH')
    expect(result.affectedServices).toContain('auth-service')
    expect(result.complianceTags).toContain('CSAP-D08')
  })

  it('[FR-R90.3] fallbacks to LOW on parse error', async () => {
    const llm: LlmClient = {
      complete: vi.fn().mockResolvedValue('not-json'),
    }
    const audit = makeAudit()
    const analyzer = new ImpactAnalyzer(llm, audit)
    const result = await analyzer.assess(
      {
        docId: 'A1',
        title: 'x',
        changeType: 'ADDED',
        prevHash: null,
        nextHash: 'h1',
        detectedAt: '2026-04-12T00:00:00Z',
      },
      { snippet: '요약' },
    )
    expect(result.level).toBe('LOW')
    expect(audit.log).toHaveBeenCalledWith(
      'regulation.impact.parse_error',
      expect.any(Object),
    )
  })
})

describe('SVC-AI-ADV-R90 ServiceMapper', () => {
  it('[FR-R90.4] maps keywords to services', () => {
    const mapper = new ServiceMapper([
      { keyword: '개인정보', service: 'user-service' },
      { keyword: '전자서명', service: 'auth-service' },
    ])
    const hits = mapper.map('개인정보보호법 전자서명 관련 조항')
    expect(hits).toEqual(expect.arrayContaining(['user-service', 'auth-service']))
  })

  it('[FR-R90.4] merge dedupes', () => {
    const mapper = new ServiceMapper([])
    const merged = mapper.merge(['a', 'b'], ['b', 'c'])
    expect(merged.sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('SVC-AI-ADV-R90 ChangeLedger + AlertRouter', () => {
  it('[FR-R90.6] ledger append-only records', async () => {
    const entries: LedgerEntry[] = []
    const storage: AppendOnlyStorage = {
      append: async (e) => {
        entries.push(e)
      },
      list: async () => entries,
    }
    const ledger = new ChangeLedger(storage)
    const entry = await ledger.record({
      change: {
        docId: 'A1',
        title: 't',
        changeType: 'ADDED',
        prevHash: null,
        nextHash: 'h',
        detectedAt: '2026-04-12T00:00:00Z',
      },
      level: 'HIGH',
      rationale: 'r',
      affectedServices: [],
      complianceTags: [],
    })
    expect(entry.id).toContain('reg-A1')
    expect(entries).toHaveLength(1)
  })

  it('[FR-R90.5] AlertRouter dispatches to all channels', async () => {
    const send1 = vi.fn().mockResolvedValue(undefined)
    const send2 = vi.fn().mockResolvedValue(undefined)
    const channels: AlertChannel[] = [
      { name: 'slack', send: send1 },
      { name: 'email', send: send2 },
    ]
    const audit = makeAudit()
    const router = new AlertRouter(channels, audit)
    await router.dispatch({
      change: {
        docId: 'A1',
        title: 't',
        changeType: 'ADDED',
        prevHash: null,
        nextHash: 'h',
        detectedAt: '2026-04-12T00:00:00Z',
      },
      level: 'CRITICAL',
      rationale: 'r',
      affectedServices: ['user-service'],
      complianceTags: ['CSAP-D08'],
    })
    expect(send1).toHaveBeenCalled()
    expect(send2).toHaveBeenCalled()
  })
})

describe('SVC-AI-ADV-R90 RegulationChangeMonitor orchestration', () => {
  it('runs full cycle: poll → diff → assess → ledger → alert → snapshot', async () => {
    const http: HttpClient = {
      get: vi.fn().mockResolvedValue(
        JSON.stringify({
          items: [
            {
              id: 'A1',
              title: 'x',
              grade: 'NOTICE',
              bodyHash: 'h1',
            },
          ],
        }),
      ),
    }
    const audit = makeAudit()
    const llm: LlmClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({ level: 'MEDIUM', rationale: 'r', affectedServices: [], complianceTags: [] }),
      ),
    }
    const kvData = new Map<string, string>()
    const kv: KeyValueStore = {
      get: async (k) => kvData.get(k) ?? null,
      set: async (k, v) => {
        kvData.set(k, v)
      },
    }
    const storage: AppendOnlyStorage = {
      append: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    }
    const monitor = new RegulationChangeMonitor({
      poller: new RegulationPoller({
        http,
        endpoint: 'x',
        apiKey: 'k',
        audit,
      }),
      detector: new DiffDetector(),
      analyzer: new ImpactAnalyzer(llm, audit),
      mapper: new ServiceMapper([]),
      ledger: new ChangeLedger(storage),
      router: new AlertRouter([], audit),
      snapshotStore: kv,
      audit,
    })
    const result = await monitor.runCycle(async () => '요약')
    expect(result.changes).toHaveLength(1)
    expect(result.assessments).toHaveLength(1)
    expect(kvData.get('regulation:snapshot')).toBeTruthy()
  })
})
