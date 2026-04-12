/**
 * Tests — SVC-AI-ADV-R162 Response Time SLA Tracker
 */

import { describe, it, expect } from 'vitest'
import { ResponseTimeSlaTracker } from '../response-time-sla-tracker'

function makeTracker(
  config: { p95?: number; p99?: number; windowSize?: number } = {},
  minSamples = 10,
) {
  let t = 1_700_000_000_000
  return new ResponseTimeSlaTracker(config, {
    now: () => {
      t += 1
      return t
    },
    minSamples,
  })
}

describe('ResponseTimeSlaTracker', () => {
  it('샘플이 최소치 미만이면 percentiles null', () => {
    const tr = makeTracker()
    tr.record(100)
    tr.record(200)
    expect(tr.getPercentiles()).toBeNull()
  })

  it('10 샘플 이상 기록 시 p50/p95/p99 계산', () => {
    const tr = makeTracker()
    for (let i = 1; i <= 20; i++) tr.record(i * 100)
    const p = tr.getPercentiles()
    expect(p).not.toBeNull()
    expect(p!.p50).toBeGreaterThan(0)
    expect(p!.p95).toBeGreaterThanOrEqual(p!.p50)
    expect(p!.p99).toBeGreaterThanOrEqual(p!.p95)
  })

  it('p95 임계값 초과 시 위반 알림 생성', () => {
    const tr = makeTracker({ p95: 500, p99: 10000 })
    for (let i = 0; i < 15; i++) tr.record(100)
    // 이후 매우 큰 값 몇 개 주입 → p95 상승
    for (let i = 0; i < 10; i++) tr.record(5000)
    const violations = tr.getViolations()
    expect(violations.some((v) => v.percentile === 'p95')).toBe(true)
  })

  it('시간창 초과 시 오래된 샘플 제거', () => {
    const tr = makeTracker({ windowSize: 5 })
    for (let i = 0; i < 10; i++) tr.record(100 + i)
    const stats = tr.getStats()
    expect(stats.sampleCount).toBe(5)
    expect(stats.total).toBe(10)
  })

  it('getViolations 는 이력 배열을 반환', () => {
    const tr = makeTracker({ p95: 50, p99: 100 })
    for (let i = 0; i < 15; i++) tr.record(1000)
    const v = tr.getViolations()
    expect(Array.isArray(v)).toBe(true)
    expect(v.length).toBeGreaterThan(0)
  })

  it('음수 latency 는 invalid_latency', () => {
    const tr = makeTracker()
    expect(() => tr.record(-1)).toThrow('invalid_latency')
    expect(() => tr.record(Number.NaN)).toThrow('invalid_latency')
  })

  it('C/S 등급 차단', () => {
    const tr = makeTracker()
    expect(() => tr.record(100, 'C')).toThrow('grade_blocked')
    expect(() => tr.record(100, 'S')).toThrow('grade_blocked')
  })

  it('감사 로그는 recorded/violation 을 기록', () => {
    const tr = makeTracker({ p95: 50, p99: 100 })
    for (let i = 0; i < 15; i++) tr.record(1000)
    const events = tr.getAuditLog().map((l) => l.event)
    expect(events).toContain('recorded')
    expect(events).toContain('violation')
  })

  it('통계는 total/violations/sampleCount 를 반환', () => {
    const tr = makeTracker()
    for (let i = 0; i < 12; i++) tr.record(200)
    const stats = tr.getStats()
    expect(stats.total).toBe(12)
    expect(stats.sampleCount).toBe(12)
  })

  it('임계값 내 응답은 위반 미생성', () => {
    const tr = makeTracker({ p95: 10000, p99: 20000 })
    for (let i = 0; i < 15; i++) tr.record(100)
    expect(tr.getViolations()).toHaveLength(0)
  })
})
