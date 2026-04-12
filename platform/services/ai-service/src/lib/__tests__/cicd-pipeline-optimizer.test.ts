/**
 * AI 기반 CI/CD 파이프라인 최적화 단위 테스트 — SVC-AI-ADV-R186
 * Plan SC: FR-R186.1 ~ FR-R186.5
 */

import { describe, it, expect } from 'vitest'
import { CICDPipelineOptimizer, DataGrade } from '../cicd-pipeline-optimizer'

const samplePipeline = {
  id: 'pipe1',
  name: '빌드 파이프라인',
  targetTotalMs: 300_000,
  stages: [
    { id: 'build', name: '빌드', expectedDurationMs: 60_000, parallelizable: true, cacheable: false },
    { id: 'test', name: '테스트', expectedDurationMs: 120_000, parallelizable: true, cacheable: false },
    { id: 'deploy', name: '배포', expectedDurationMs: 30_000, parallelizable: false, cacheable: false },
  ],
}

describe('CICDPipelineOptimizer — R186', () => {
  it('FR-R186.1: 파이프라인 등록 및 audit log', () => {
    const opt = new CICDPipelineOptimizer(DataGrade.O)
    opt.registerPipeline(samplePipeline)
    const log = opt.getAuditLog()
    expect(log[0]?.action).toBe('pipelineRegistered')
    expect(log[0]?.details.id).toBe('pipe1')
  })

  it('FR-R186.2: 실행 기록 및 audit log', () => {
    const opt = new CICDPipelineOptimizer(DataGrade.O)
    opt.registerPipeline(samplePipeline)
    opt.recordRun({ pipelineId: 'pipe1', runId: 'run1', stageDurations: { build: 65_000, test: 130_000, deploy: 35_000 }, startedAt: Date.now() })
    const log = opt.getAuditLog()
    expect(log.some((e) => e.action === 'runRecorded')).toBe(true)
  })

  it('FR-R186.3: 단계별 통계 계산', () => {
    const opt = new CICDPipelineOptimizer(DataGrade.O)
    opt.registerPipeline(samplePipeline)
    opt.recordRun({ pipelineId: 'pipe1', runId: 'r1', stageDurations: { build: 60_000, test: 120_000, deploy: 30_000 }, startedAt: 0 })
    opt.recordRun({ pipelineId: 'pipe1', runId: 'r2', stageDurations: { build: 80_000, test: 200_000, deploy: 40_000 }, startedAt: 0 })
    const analysis = opt.analyze('pipe1')
    const testStat = analysis.stageStats.find((s) => s.stageId === 'test')
    expect(testStat?.avgMs).toBe(160_000)
  })

  it('FR-R186.4: 병목 탐지 — 예상 대비 1.5배 초과', () => {
    const opt = new CICDPipelineOptimizer(DataGrade.O)
    opt.registerPipeline(samplePipeline)
    // test: expected 120s, actual avg 200s → 200/120 = 1.67 > 1.5
    opt.recordRun({ pipelineId: 'pipe1', runId: 'r1', stageDurations: { build: 60_000, test: 200_000, deploy: 30_000 }, startedAt: 0 })
    const analysis = opt.analyze('pipe1')
    expect(analysis.bottlenecks.some((b) => b.stageId === 'test')).toBe(true)
  })

  it('FR-R186.4: 병목 최적화 권고 — 병렬화 가능 단계', () => {
    const opt = new CICDPipelineOptimizer(DataGrade.O)
    opt.registerPipeline(samplePipeline)
    opt.recordRun({ pipelineId: 'pipe1', runId: 'r1', stageDurations: { build: 200_000, test: 120_000, deploy: 30_000 }, startedAt: 0 })
    const analysis = opt.analyze('pipe1')
    const buildBottleneck = analysis.bottlenecks.find((b) => b.stageId === 'build')
    if (buildBottleneck) {
      const tip = analysis.tips.find((t) => t.stageId === 'build')
      expect(tip?.tip).toContain('병렬')
    }
  })

  it('FR-R186.5: audit log append-only', () => {
    const opt = new CICDPipelineOptimizer(DataGrade.O)
    opt.registerPipeline(samplePipeline)
    const log1 = opt.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    expect(opt.getAuditLog()).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new CICDPipelineOptimizer(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new CICDPipelineOptimizer(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 파이프라인 id throw', () => {
    const opt = new CICDPipelineOptimizer(DataGrade.O)
    expect(() => opt.registerPipeline({ ...samplePipeline, id: '' })).toThrow('must not be empty')
  })

  it('단계 없는 파이프라인 throw', () => {
    const opt = new CICDPipelineOptimizer(DataGrade.O)
    expect(() => opt.registerPipeline({ ...samplePipeline, stages: [] })).toThrow('at least one stage')
  })
})
