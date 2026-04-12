/**
 * Unit tests for Data Lineage Tracker — SVC-AI-ADV-R95
 */

import { describe, it, expect, vi } from 'vitest'
import {
  DataLineageTracker,
  type AuditSink,
} from '../data-lineage-tracker'

describe('SVC-AI-ADV-R95 DataLineageTracker', () => {
  it('[FR-R95.1] registers dataset node', () => {
    const t = new DataLineageTracker()
    const n = t.registerDataset({
      id: 'ds1',
      grade: 'O',
      owner: 'audit-team',
      type: 'SOURCE',
      tags: ['public'],
    })
    expect(n.id).toBe('ds1')
    expect(n.createdAt).toBeDefined()
  })

  it('[FR-R95.2, FR-R95.4] records flow and propagates grade', () => {
    const t = new DataLineageTracker()
    t.registerDataset({ id: 'src', grade: 'C', owner: 'u', type: 'SOURCE', tags: [] })
    t.registerDataset({ id: 'dst', grade: 'O', owner: 'u', type: 'SINK', tags: [] })
    t.recordFlow('src', 'dst', 'COPY', '통계')
    const snap = t.snapshot()
    const dst = snap.nodes.find((n) => n.id === 'dst')!
    expect(dst.grade).toBe('C') // upgraded from O to C
  })

  it('[FR-R95.3] traceLineage returns upstream/downstream', () => {
    const t = new DataLineageTracker()
    t.registerDataset({ id: 'a', grade: 'O', owner: 'u', type: 'SOURCE', tags: [] })
    t.registerDataset({ id: 'b', grade: 'O', owner: 'u', type: 'TRANSFORM', tags: [] })
    t.registerDataset({ id: 'c', grade: 'O', owner: 'u', type: 'SINK', tags: [] })
    t.recordFlow('a', 'b', 'TRANSFORM', 'x')
    t.recordFlow('b', 'c', 'COPY', 'y')
    const trace = t.traceLineage('b')
    expect(trace.upstream.map((n) => n.id)).toContain('a')
    expect(trace.downstream.map((n) => n.id)).toContain('c')
  })

  it('[FR-R95.5] detects external sensitive violation', () => {
    const t = new DataLineageTracker()
    t.registerDataset({ id: 'pii', grade: 'C', owner: 'u', type: 'SOURCE', tags: [] })
    t.registerDataset({
      id: 'saas',
      grade: 'O',
      owner: 'u',
      type: 'SINK',
      tags: ['external'],
    })
    t.recordFlow('pii', 'saas', 'EXPORT', '외부전송')
    const violations = t.detectViolations()
    expect(violations).toHaveLength(1)
    expect(violations[0]!.type).toBe('EXTERNAL_SENSITIVE')
  })

  it('[FR-R95.2] throws on missing node', () => {
    const t = new DataLineageTracker()
    expect(() => t.recordFlow('x', 'y', 'COPY', 'z')).toThrow(/source/)
  })

  it('[FR-R95.3] handles cycle safely', () => {
    const t = new DataLineageTracker()
    t.registerDataset({ id: 'a', grade: 'O', owner: 'u', type: 'TRANSFORM', tags: [] })
    t.registerDataset({ id: 'b', grade: 'O', owner: 'u', type: 'TRANSFORM', tags: [] })
    t.recordFlow('a', 'b', 'COPY', 'x')
    t.recordFlow('b', 'a', 'COPY', 'y')
    // Should not loop forever
    const trace = t.traceLineage('a')
    expect(trace.upstream.length).toBeGreaterThanOrEqual(1)
  })

  it('emitAudit writes summary', async () => {
    const audit: AuditSink = { log: vi.fn().mockResolvedValue(undefined) }
    const t = new DataLineageTracker(audit)
    t.registerDataset({ id: 'a', grade: 'O', owner: 'u', type: 'SOURCE', tags: [] })
    await t.emitAudit()
    expect(audit.log).toHaveBeenCalledWith(
      'lineage.snapshot',
      expect.objectContaining({ nodes: 1 }),
    )
  })
})
