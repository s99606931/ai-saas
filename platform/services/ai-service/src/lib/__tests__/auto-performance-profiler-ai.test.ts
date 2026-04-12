import { describe, it, expect, beforeEach } from 'vitest'
import { AutoPerformanceProfilerAI } from '../auto-performance-profiler-ai'

describe('AutoPerformanceProfilerAI', () => {
  let profiler: AutoPerformanceProfilerAI

  beforeEach(() => {
    profiler = new AutoPerformanceProfilerAI()
    profiler.registerTarget({ targetId: 'TGT-1', name: '민원 API', type: 'API' })
  })

  it('알 수 없는 타겟 샘플 추가 시 오류', () => {
    expect(() => profiler.addSample({ targetId: 'UNKNOWN', executionMs: 100, memoryMb: 50, cpuPercent: 20, timestamp: Date.now() })).toThrow('Unknown target')
  })

  it('알 수 없는 타겟 프로파일링 시 오류', () => {
    expect(() => profiler.profile('UNKNOWN')).toThrow('Unknown target')
  })

  it('샘플 없으면 기본 보고서 반환', () => {
    const report = profiler.profile('TGT-1')
    expect(report.sampleCount).toBe(0)
    expect(report.bottleneckType).toBe('NONE')
  })

  it('CPU_BOUND 탐지', () => {
    for (let i = 0; i < 5; i++) {
      profiler.addSample({ targetId: 'TGT-1', executionMs: 200, memoryMb: 100, cpuPercent: 85, timestamp: Date.now() })
    }
    const report = profiler.profile('TGT-1')
    expect(report.bottleneckType).toBe('CPU_BOUND')
    expect(report.optimizationSuggestions.length).toBeGreaterThan(0)
  })

  it('IO_BOUND 탐지 — 레이턴시 높음', () => {
    for (let i = 0; i < 5; i++) {
      profiler.addSample({ targetId: 'TGT-1', executionMs: 2000, memoryMb: 100, cpuPercent: 20, timestamp: Date.now() })
    }
    const report = profiler.profile('TGT-1')
    expect(report.bottleneckType).toBe('IO_BOUND')
  })

  it('p99 레이턴시 계산', () => {
    for (let i = 1; i <= 100; i++) {
      profiler.addSample({ targetId: 'TGT-1', executionMs: i * 5, memoryMb: 50, cpuPercent: 30, timestamp: Date.now() })
    }
    const report = profiler.profile('TGT-1')
    expect(report.p99ExecutionMs).toBeGreaterThanOrEqual(490)
  })

  it('감사 로그 복사본 반환', () => {
    profiler.profile('TGT-1')
    const log = profiler.getAuditLog()
    log.push({ timestamp: '', action: 'injected', targetId: 'X', detail: {} })
    expect(profiler.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
