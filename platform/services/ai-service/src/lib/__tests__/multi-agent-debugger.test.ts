/**
 * 멀티에이전트 디버거 단위 테스트 — SVC-AI-ADV-R158
 * Plan SC: FR-R158.1 ~ FR-R158.6
 */

import { describe, it, expect } from 'vitest'
import { MultiAgentDebugger, DataGrade } from '../multi-agent-debugger'

describe('MultiAgentDebugger — R158', () => {
  it('FR-R158.1: 메시지 기록 및 audit log', () => {
    const dbg = new MultiAgentDebugger(DataGrade.O)
    dbg.recordMessage({ id: 'm1', from: 'A', to: 'B', topic: 'hello', timestamp: 1000 })
    const log = dbg.getAuditLog()
    expect(log[0]?.action).toBe('messageRecorded')
  })

  it('FR-R158.2: 데드락 탐지 — 순환 메시지 경로', () => {
    const dbg = new MultiAgentDebugger(DataGrade.O)
    dbg.recordMessage({ id: 'm1', from: 'A', to: 'B', topic: 't', timestamp: 1000 })
    dbg.recordMessage({ id: 'm2', from: 'B', to: 'C', topic: 't', timestamp: 2000 })
    dbg.recordMessage({ id: 'm3', from: 'C', to: 'A', topic: 't', timestamp: 3000 })
    const report = dbg.analyze()
    expect(report.deadlock.detected).toBe(true)
    expect(report.deadlock.cycle.length).toBeGreaterThan(0)
  })

  it('FR-R158.2: 데드락 없는 경우', () => {
    const dbg = new MultiAgentDebugger(DataGrade.O)
    dbg.recordMessage({ id: 'm1', from: 'A', to: 'B', topic: 't', timestamp: 1000 })
    dbg.recordMessage({ id: 'm2', from: 'B', to: 'C', topic: 't', timestamp: 2000 })
    const report = dbg.analyze()
    expect(report.deadlock.detected).toBe(false)
  })

  it('FR-R158.3: 무한루프 탐지 — edge threshold 초과', () => {
    const dbg = new MultiAgentDebugger(DataGrade.O, { loopThreshold: 3 })
    for (let i = 0; i < 4; i++) {
      dbg.recordMessage({ id: `m${i}`, from: 'A', to: 'B', topic: 'ping', timestamp: i * 100 })
    }
    const report = dbg.analyze()
    expect(report.loops.length).toBeGreaterThan(0)
    expect(report.loops[0]?.count).toBeGreaterThanOrEqual(3)
  })

  it('FR-R158.4: 병목 에이전트 탐지 — 최다 수신 에이전트', () => {
    const dbg = new MultiAgentDebugger(DataGrade.O)
    dbg.recordMessage({ id: 'm1', from: 'A', to: 'C', topic: 't', timestamp: 1000 })
    dbg.recordMessage({ id: 'm2', from: 'B', to: 'C', topic: 't', timestamp: 2000 })
    dbg.recordMessage({ id: 'm3', from: 'D', to: 'C', topic: 't', timestamp: 3000 })
    const report = dbg.analyze()
    expect(report.bottleneck).toBe('C')
  })

  it('FR-R158.5: 타임라인 ms 계산', () => {
    const dbg = new MultiAgentDebugger(DataGrade.O)
    dbg.recordMessage({ id: 'm1', from: 'A', to: 'B', topic: 't', timestamp: 1000 })
    dbg.recordMessage({ id: 'm2', from: 'B', to: 'A', topic: 't', timestamp: 5000 })
    const report = dbg.analyze()
    expect(report.timelineMs).toBe(4000)
  })

  it('FR-R158.6: audit log append-only', () => {
    const dbg = new MultiAgentDebugger(DataGrade.O)
    dbg.recordMessage({ id: 'm1', from: 'A', to: 'B', topic: 't', timestamp: 1000 })
    const log1 = dbg.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    const log2 = dbg.getAuditLog()
    expect(log2).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new MultiAgentDebugger(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new MultiAgentDebugger(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 메시지 id throw', () => {
    const dbg = new MultiAgentDebugger(DataGrade.O)
    expect(() => dbg.recordMessage({ id: '', from: 'A', to: 'B', topic: 't', timestamp: 0 }))
      .toThrow('must not be empty')
  })

  it('메시지 없을 때 analyze — totalMessages=0', () => {
    const dbg = new MultiAgentDebugger(DataGrade.O)
    const report = dbg.analyze()
    expect(report.totalMessages).toBe(0)
    expect(report.deadlock.detected).toBe(false)
    expect(report.bottleneck).toBeNull()
  })
})
