/**
 * Tests — SVC-AI-ADV-R132 AI Audit Replay Engine
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  AIAuditReplayEngine,
  DataGrade,
  type AuditEvent,
} from '../ai-audit-replay-engine'

function ev(
  id: string,
  ts: number,
  actor = 'user',
  action = 'read',
  resource = 'doc',
  traceId?: string,
  payload?: Record<string, unknown>,
): AuditEvent {
  return { id, timestamp: ts, actor, action, resource, traceId, payload }
}

describe('AIAuditReplayEngine — R132', () => {
  let engine: AIAuditReplayEngine

  beforeEach(() => {
    engine = new AIAuditReplayEngine(DataGrade.O)
  })

  it('FR-R132.1: ingest 기본 + 중복 id throw', () => {
    engine.ingest(ev('e1', 1000))
    engine.ingest(ev('e2', 2000))
    expect(() => engine.ingest(ev('e1', 3000))).toThrow('duplicate')
  })

  it('FR-R132.2: from/to 범위 필터', () => {
    engine.ingest(ev('e1', 1000))
    engine.ingest(ev('e2', 2000))
    engine.ingest(ev('e3', 3000))
    const r = engine.replay({ from: 1500, to: 2500 })
    expect(r.length).toBe(1)
    expect(r[0]?.id).toBe('e2')
  })

  it('actor/action/resource 필터', () => {
    engine.ingest(ev('e1', 1, 'admin', 'delete', 'user'))
    engine.ingest(ev('e2', 2, 'user', 'read', 'doc'))
    engine.ingest(ev('e3', 3, 'admin', 'read', 'doc'))
    expect(engine.replay({ actor: 'admin' }).length).toBe(2)
    expect(engine.replay({ action: 'delete' }).length).toBe(1)
    expect(engine.replay({ resource: 'doc' }).length).toBe(2)
  })

  it('traceId 필터', () => {
    engine.ingest(ev('e1', 1, 'u', 'a', 'r', 'T-1'))
    engine.ingest(ev('e2', 2, 'u', 'a', 'r', 'T-2'))
    engine.ingest(ev('e3', 3, 'u', 'a', 'r', 'T-1'))
    const r = engine.replay({ traceId: 'T-1' })
    expect(r.length).toBe(2)
  })

  it('FR-R132.3: buildTimeline bucket 그룹화', () => {
    engine.ingest(ev('e1', 1000))
    engine.ingest(ev('e2', 1500))
    engine.ingest(ev('e3', 3000))
    const events = engine.replay({})
    const buckets = engine.buildTimeline(events, 1000)
    expect(buckets.length).toBeGreaterThanOrEqual(2)
    const total = buckets.reduce((a, b) => a + b.count, 0)
    expect(total).toBe(3)
  })

  it('bucket 경계 계산', () => {
    engine.ingest(ev('e1', 1000))
    engine.ingest(ev('e2', 1999))
    engine.ingest(ev('e3', 2000))
    const buckets = engine.buildTimeline(engine.replay({}), 1000)
    const firstBucket = buckets[0]
    expect(firstBucket?.count).toBe(2)
  })

  it('FR-R132.4: traceCausality 체인 + duration', () => {
    engine.ingest(ev('e1', 1000, 'u', 'start', 'r', 'TRC'))
    engine.ingest(ev('e2', 1500, 'u', 'middle', 'r', 'TRC'))
    engine.ingest(ev('e3', 2000, 'u', 'end', 'r', 'TRC'))
    engine.ingest(ev('e4', 3000, 'u', 'other', 'r', 'OTHER'))
    const chain = engine.traceCausality('TRC')
    expect(chain.length).toBe(3)
    expect(chain.durationMs).toBe(1000)
    expect(chain.events[0]?.action).toBe('start')
    expect(chain.events[2]?.action).toBe('end')
  })

  it('존재하지 않는 traceId → 빈 체인', () => {
    const chain = engine.traceCausality('none')
    expect(chain.length).toBe(0)
    expect(chain.durationMs).toBe(0)
  })

  it('FR-R132.5: maskSensitive 이메일/주민번호/전화', () => {
    engine.ingest(
      ev('e1', 1, 'u', 'a', 'r', undefined, {
        email: 'user@test.com',
        rrn: '901010-1234567',
        phone: '010-1111-2222',
      }),
    )
    const r = engine.replay({})
    const payload = r[0]?.payload as Record<string, string>
    expect(payload['email']).toBe('***@***')
    expect(payload['rrn']).toBe('******-*******')
    expect(payload['phone']).toBe('010-****-****')
  })

  it('maskSensitive 시크릿 키 필드', () => {
    engine.ingest(
      ev('e1', 1, 'u', 'a', 'r', undefined, {
        apiKey: 'sk-12345',
        password: 'pw',
        normal: 'ok',
      }),
    )
    const r = engine.replay({})
    const payload = r[0]?.payload as Record<string, string>
    expect(payload['apiKey']).toBe('[REDACTED]')
    expect(payload['password']).toBe('[REDACTED]')
    expect(payload['normal']).toBe('ok')
  })

  it('FR-R132.6: exportVisualization 통합', () => {
    engine.ingest(ev('e1', 1000, 'u', 'a', 'r', 'T1'))
    engine.ingest(ev('e2', 1500, 'u', 'a', 'r', 'T1'))
    engine.ingest(ev('e3', 2500, 'u', 'a', 'r', 'T2'))
    const exp = engine.exportVisualization({}, 1000)
    expect(exp.buckets.length).toBeGreaterThanOrEqual(2)
    expect(exp.chains.length).toBe(2)
  })

  it('원본 불변성 검증', () => {
    engine.ingest(
      ev('e1', 1, 'u', 'a', 'r', undefined, { key: 'value' }),
    )
    const r = engine.replay({})
    const first = r[0]
    if (first && first.payload) {
      first.payload['key'] = 'MUTATED'
    }
    const r2 = engine.replay({})
    const first2 = r2[0]
    expect((first2?.payload as Record<string, unknown>)['key']).toBe('value')
  })

  it('N2SF N-05: C/S 등급 차단', () => {
    expect(() => new AIAuditReplayEngine(DataGrade.C)).toThrow('N2SF N-05')
    expect(() => new AIAuditReplayEngine(DataGrade.S)).toThrow('N2SF N-05')
  })

  it('bucketMs <= 0 throw', () => {
    engine.ingest(ev('e1', 1))
    expect(() => engine.buildTimeline(engine.replay({}), 0)).toThrow('positive')
    expect(() => engine.buildTimeline(engine.replay({}), -100)).toThrow(
      'positive',
    )
  })

  it('ingest 빈 id throw', () => {
    expect(() => engine.ingest(ev('', 1))).toThrow('must not be empty')
  })

  it('ingest 빈 actor/action/resource throw', () => {
    expect(() => engine.ingest(ev('e', 1, ''))).toThrow('actor')
    expect(() => engine.ingest(ev('e', 1, 'u', ''))).toThrow('action')
    expect(() => engine.ingest(ev('e', 1, 'u', 'a', ''))).toThrow('resource')
  })

  it('FR-R132.7: getAuditLog append-only', () => {
    engine.ingest(ev('e1', 1))
    const l1 = engine.getAuditLog()
    l1.push({ action: 'ingested', timestamp: 0, details: {} })
    const l2 = engine.getAuditLog()
    expect(l2.length).toBeLessThan(l1.length)
  })
})
