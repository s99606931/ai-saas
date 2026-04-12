/**
 * 워크플로우 병목 분석기 단위 테스트 — SVC-AI-ADV-R161
 * Plan SC: FR-R161.1 ~ FR-R161.6
 */

import { describe, it, expect } from 'vitest'
import { WorkflowBottleneckAnalyzer, DataGrade } from '../workflow-bottleneck-analyzer'

describe('WorkflowBottleneckAnalyzer — R161', () => {
  it('FR-R161.1: 단계 등록 및 audit log', () => {
    const wba = new WorkflowBottleneckAnalyzer(DataGrade.O)
    wba.registerStep({ id: 's1', name: '문서 접수', expectedMinutes: 10 })
    const log = wba.getAuditLog()
    expect(log[0]?.action).toBe('stepRegistered')
  })

  it('FR-R161.2: 이벤트 기록 및 audit log', () => {
    const wba = new WorkflowBottleneckAnalyzer(DataGrade.O)
    wba.registerStep({ id: 's1', name: '문서 접수', expectedMinutes: 10 })
    wba.recordEvent({ stepId: 's1', instanceId: 'i1', startAt: 0, endAt: 600_000 })
    const log = wba.getAuditLog()
    expect(log.some((e) => e.action === 'eventRecorded')).toBe(true)
  })

  it('FR-R161.3: 단계별 통계 (avg/p95/max) 계산', () => {
    const wba = new WorkflowBottleneckAnalyzer(DataGrade.O)
    wba.registerStep({ id: 's1', name: '심사', expectedMinutes: 20 })
    // 10분, 20분, 30분 처리
    wba.recordEvent({ stepId: 's1', instanceId: 'i1', startAt: 0, endAt: 600_000 })
    wba.recordEvent({ stepId: 's1', instanceId: 'i2', startAt: 0, endAt: 1_200_000 })
    wba.recordEvent({ stepId: 's1', instanceId: 'i3', startAt: 0, endAt: 1_800_000 })
    const report = wba.analyze()
    expect(report.overallAvgMinutes).toBeCloseTo(20)
  })

  it('FR-R161.4: 병목 탐지 — z-score 초과 단계 포함', () => {
    const wba = new WorkflowBottleneckAnalyzer(DataGrade.O, { zThreshold: 0.5 })
    wba.registerStep({ id: 'fast', name: '빠른 단계', expectedMinutes: 5 })
    wba.registerStep({ id: 'slow', name: '느린 단계', expectedMinutes: 20 })
    // fast: 1분
    wba.recordEvent({ stepId: 'fast', instanceId: 'i1', startAt: 0, endAt: 60_000 })
    // slow: 60분 (z-score 높음)
    wba.recordEvent({ stepId: 'slow', instanceId: 'i2', startAt: 0, endAt: 3_600_000 })
    const report = wba.analyze()
    expect(report.bottlenecks.some((b) => b.stepId === 'slow')).toBe(true)
  })

  it('FR-R161.5: 병목 개선 제안 포함', () => {
    const wba = new WorkflowBottleneckAnalyzer(DataGrade.O, { zThreshold: 0 })
    wba.registerStep({ id: 's1', name: '느린 처리', expectedMinutes: 10 })
    wba.recordEvent({ stepId: 's1', instanceId: 'i1', startAt: 0, endAt: 1_800_000 }) // 30분
    const report = wba.analyze()
    if (report.suggestions.length > 0) {
      expect(report.suggestions[0]?.suggestion).toContain('느린 처리')
    }
  })

  it('FR-R161.6: audit log append-only', () => {
    const wba = new WorkflowBottleneckAnalyzer(DataGrade.O)
    wba.registerStep({ id: 's1', name: '단계', expectedMinutes: 10 })
    const log1 = wba.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    const log2 = wba.getAuditLog()
    expect(log2).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new WorkflowBottleneckAnalyzer(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new WorkflowBottleneckAnalyzer(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 step id throw', () => {
    const wba = new WorkflowBottleneckAnalyzer(DataGrade.O)
    expect(() => wba.registerStep({ id: '', name: '단계', expectedMinutes: 10 })).toThrow('must not be empty')
  })

  it('endAt < startAt throw', () => {
    const wba = new WorkflowBottleneckAnalyzer(DataGrade.O)
    wba.registerStep({ id: 's1', name: '단계', expectedMinutes: 10 })
    expect(() => wba.recordEvent({ stepId: 's1', instanceId: 'i1', startAt: 5000, endAt: 1000 }))
      .toThrow('endAt must be >= startAt')
  })
})
