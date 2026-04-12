/**
 * Unit tests for Cache Prewarming Scheduler — SVC-AI-ADV-R109
 */

import { describe, it, expect } from 'vitest'
import {
  CachePrewarmingScheduler,
  type AccessEvent,
} from '../cache-prewarming-scheduler'

const baseDay = new Date('2026-04-13T00:00:00Z') // Monday UTC

const mkEvent = (rid: string, hour: number, dow = 1): AccessEvent => ({
  resourceId: rid,
  // 2026-04-13 is Monday; use arbitrary day with right dow/hour
  timestamp: Date.UTC(2026, 3, 6 + dow, hour, 0, 0),
})

describe('SVC-AI-ADV-R109 CachePrewarmingScheduler', () => {
  it('[FR-R109.2] identifies top-N resources per hour', () => {
    const s = new CachePrewarmingScheduler()
    const events: AccessEvent[] = [
      mkEvent('a', 9),
      mkEvent('a', 9),
      mkEvent('a', 9),
      mkEvent('b', 9),
      mkEvent('c', 9),
    ]
    const plan = s.plan(events, { topN: 2, leadMinutes: 15, baseDay })
    const entry = plan.find((e) => e.hour === 9)!
    expect(entry.resources.slice(0, 2)).toContain('a')
    expect(entry.resources).toHaveLength(2)
  })

  it('[FR-R109.3] leadMinutes reflected in triggerIso', () => {
    const s = new CachePrewarmingScheduler()
    const events = [mkEvent('a', 10)]
    const plan = s.plan(events, { topN: 1, leadMinutes: 30, baseDay })
    const entry = plan[0]!
    // trigger = 10:00 - 30m = 09:30 UTC on baseDay
    const t = new Date(entry.triggerIso)
    expect(t.getUTCHours()).toBe(9)
    expect(t.getUTCMinutes()).toBe(30)
  })

  it('[FR-R109.1] empty events returns empty plan', () => {
    const s = new CachePrewarmingScheduler()
    expect(s.plan([], { topN: 5, leadMinutes: 10, baseDay })).toEqual([])
  })

  it('[FR-R109.2] groups multiple hours', () => {
    const s = new CachePrewarmingScheduler()
    const events = [mkEvent('a', 9), mkEvent('b', 14)]
    const plan = s.plan(events, { topN: 1, leadMinutes: 5, baseDay })
    expect(plan).toHaveLength(2)
  })

  it('[FR-R109.4] dedupes resources', () => {
    const s = new CachePrewarmingScheduler()
    const events = [mkEvent('a', 9), mkEvent('a', 9), mkEvent('a', 9)]
    const plan = s.plan(events, { topN: 5, leadMinutes: 5, baseDay })
    expect(plan[0]!.resources).toEqual(['a'])
  })

  it('[FR-R109.4] sorted by hour', () => {
    const s = new CachePrewarmingScheduler()
    const events = [mkEvent('b', 14), mkEvent('a', 9)]
    const plan = s.plan(events, { topN: 5, leadMinutes: 5, baseDay })
    expect(plan.map((e) => e.hour)).toEqual([9, 14])
  })

  it('[FR-R109.2] topN limits result size', () => {
    const s = new CachePrewarmingScheduler()
    const events: AccessEvent[] = []
    for (let i = 0; i < 10; i++) events.push(mkEvent(`r${i}`, 9))
    const plan = s.plan(events, { topN: 3, leadMinutes: 5, baseDay })
    expect(plan[0]!.resources).toHaveLength(3)
  })
})
