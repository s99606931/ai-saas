/**
 * AI Embedding Drift Monitor 단위 테스트 — SVC-AI-ADV-R128
 * Plan SC: FR-R128.1 ~ FR-R128.6
 */

import { describe, it, expect, vi } from 'vitest'
import { AIEmbeddingDriftMonitor, DataGrade } from '../ai-embedding-drift-monitor'

function makeVectors(n: number, dim: number, value = 0): number[][] {
  return Array.from({ length: n }, () => Array.from({ length: dim }, () => value))
}

function makeShiftedVectors(n: number, dim: number, shift: number): number[][] {
  return Array.from({ length: n }, () => Array.from({ length: dim }, () => shift))
}

describe('AIEmbeddingDriftMonitor — R128', () => {
  it('FR-R128.1: setBaseline 기본 동작', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O)
    const vecs = makeVectors(10, 3, 0.5)
    expect(() => monitor.setBaseline(vecs)).not.toThrow()
    const log = monitor.getAuditLog()
    expect(log[0]?.action).toBe('baselineSet')
  })

  it('FR-R128.2: addSample 누적', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O)
    monitor.setBaseline(makeVectors(10, 2, 0))
    monitor.addSample(makeVectors(5, 2, 0.1))
    monitor.addSample(makeVectors(3, 2, 0.2))
    const log = monitor.getAuditLog()
    const sampleActions = log.filter((e) => e.action === 'sampleAdded')
    expect(sampleActions).toHaveLength(2)
  })

  it('FR-R128.3: 동일 분포 → stable', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O)
    const base = Array.from({ length: 50 }, (_, i) => [i * 0.02, i * 0.01])
    monitor.setBaseline(base)
    monitor.addSample([...base])
    const report = monitor.computeDrift()
    expect(report.severity).toBe('stable')
  })

  it('FR-R128.3: 큰 분포 이동 → major', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O, {
      psiMinor: 0.05,
      psiMajor: 0.1,
    })
    const base = makeVectors(20, 1, 0)
    const shifted = makeShiftedVectors(20, 1, 100)
    monitor.setBaseline(base)
    monitor.addSample(shifted)
    const report = monitor.computeDrift()
    expect(['minor', 'major']).toContain(report.severity)
  })

  it('FR-R128.3: 중간 이동 → minor', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O, {
      bins: 5,
      psiMinor: 0.01,
      psiMajor: 10,
    })
    const base = Array.from({ length: 20 }, (_, i) => [i * 0.1])
    const shifted = Array.from({ length: 20 }, (_, i) => [i * 0.1 + 0.3])
    monitor.setBaseline(base)
    monitor.addSample(shifted)
    const report = monitor.computeDrift()
    expect(report.severity).toBe('minor')
  })

  it('KL divergence 계산: 동일 분포 → 거의 0', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O)
    const base = Array.from({ length: 30 }, (_, i) => [i * 0.1])
    monitor.setBaseline(base)
    monitor.addSample([...base])
    const report = monitor.computeDrift()
    expect(report.avgKL).toBeGreaterThanOrEqual(0)
    expect(report.avgKL).toBeLessThan(0.5)
  })

  it('perDim 배열 길이 검증', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O)
    monitor.setBaseline(makeVectors(10, 3, 0))
    monitor.addSample(makeVectors(10, 3, 1))
    const report = monitor.computeDrift()
    expect(report.perDim).toHaveLength(3)
  })

  it('FR-R128.5: onDriftAlert listener 호출', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O, {
      psiMajor: 0.001,
    })
    const cb = vi.fn()
    monitor.onDriftAlert(cb)
    const base = makeVectors(20, 1, 0)
    const shifted = makeShiftedVectors(20, 1, 50)
    monitor.setBaseline(base)
    monitor.addSample(shifted)
    monitor.computeDrift()
    expect(cb).toHaveBeenCalled()
  })

  it('reset 후 상태 초기화', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O)
    monitor.setBaseline(makeVectors(5, 2, 0))
    monitor.reset()
    expect(() => monitor.computeDrift()).toThrow('baseline not set')
    const log = monitor.getAuditLog()
    expect(log.some((e) => e.action === 'reset')).toBe(true)
  })

  it('C 등급 차단', () => {
    expect(() => new AIEmbeddingDriftMonitor(DataGrade.C)).toThrow('BLOCKED')
  })

  it('S 등급 차단', () => {
    expect(() => new AIEmbeddingDriftMonitor(DataGrade.S)).toThrow('BLOCKED')
  })

  it('벡터 길이 불일치 throw', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O)
    monitor.setBaseline(makeVectors(5, 3, 0))
    expect(() => monitor.addSample([[1, 2]])).toThrow('dimension mismatch')
  })

  it('FR-R128.6: getAuditLog append-only (복사본)', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O)
    monitor.setBaseline(makeVectors(5, 2, 0))
    const log1 = monitor.getAuditLog()
    log1.push({ action: 'reset', timestamp: 0, details: {} })
    const log2 = monitor.getAuditLog()
    expect(log2).toHaveLength(1)
  })

  it('베이스라인 없이 addSample → throw', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O)
    expect(() => monitor.addSample(makeVectors(3, 2, 0))).toThrow('baseline not set')
  })

  it('샘플 없이 computeDrift → throw', () => {
    const monitor = new AIEmbeddingDriftMonitor(DataGrade.O)
    monitor.setBaseline(makeVectors(5, 2, 0))
    expect(() => monitor.computeDrift()).toThrow('no samples')
  })
})
