import { describe, it, expect, beforeEach } from 'vitest'
import { BatchProcessingOptimizer } from '../batch-processing-optimizer'
import type { JobResult } from '../batch-processing-optimizer'

describe('BatchProcessingOptimizer', () => {
  let optimizer: BatchProcessingOptimizer

  beforeEach(() => {
    optimizer = new BatchProcessingOptimizer()
  })

  it('자원 제약 초과 잡은 스케줄에서 제외', () => {
    optimizer.registerJob({ jobId: 'J1', name: '대용량', priority: 'HIGH', estimatedMs: 1000, requiredCpu: 32, requiredMemoryMb: 65536 })
    optimizer.registerJob({ jobId: 'J2', name: '소용량', priority: 'NORMAL', estimatedMs: 500, requiredCpu: 2, requiredMemoryMb: 512 })
    const schedule = optimizer.optimize(4, 2048)
    expect(schedule.order.map((j) => j.jobId)).not.toContain('J1')
    expect(schedule.order.map((j) => j.jobId)).toContain('J2')
  })

  it('우선순위 순서: CRITICAL > HIGH > NORMAL > LOW', () => {
    optimizer.registerJob({ jobId: 'J-LOW', name: 'low', priority: 'LOW', estimatedMs: 100, requiredCpu: 1, requiredMemoryMb: 128 })
    optimizer.registerJob({ jobId: 'J-CRIT', name: 'crit', priority: 'CRITICAL', estimatedMs: 200, requiredCpu: 1, requiredMemoryMb: 128 })
    optimizer.registerJob({ jobId: 'J-NORM', name: 'norm', priority: 'NORMAL', estimatedMs: 150, requiredCpu: 1, requiredMemoryMb: 128 })
    const schedule = optimizer.optimize(8, 1024)
    expect(schedule.order[0]!.jobId).toBe('J-CRIT')
    expect(schedule.order[schedule.order.length - 1]!.jobId).toBe('J-LOW')
  })

  it('동순위 잡은 estimatedMs 오름차순', () => {
    optimizer.registerJob({ jobId: 'J-A', name: 'a', priority: 'NORMAL', estimatedMs: 500, requiredCpu: 1, requiredMemoryMb: 128 })
    optimizer.registerJob({ jobId: 'J-B', name: 'b', priority: 'NORMAL', estimatedMs: 100, requiredCpu: 1, requiredMemoryMb: 128 })
    const schedule = optimizer.optimize(4, 512)
    expect(schedule.order[0]!.jobId).toBe('J-B')
  })

  it('estimatedTotalMs는 포함된 잡의 합산', () => {
    optimizer.registerJob({ jobId: 'J1', name: 'a', priority: 'HIGH', estimatedMs: 300, requiredCpu: 1, requiredMemoryMb: 128 })
    optimizer.registerJob({ jobId: 'J2', name: 'b', priority: 'NORMAL', estimatedMs: 700, requiredCpu: 1, requiredMemoryMb: 128 })
    const schedule = optimizer.optimize(4, 512)
    expect(schedule.estimatedTotalMs).toBe(1000)
  })

  it('결과 기록 후 효율 리포트 생성', () => {
    optimizer.registerJob({ jobId: 'J1', name: 'test', priority: 'HIGH', estimatedMs: 500, requiredCpu: 2, requiredMemoryMb: 256 })
    const result: JobResult = { jobId: 'J1', actualMs: 480, cpuUsed: 1.8, memoryUsed: 240, status: 'DONE', completedAt: new Date().toISOString() }
    optimizer.recordResult(result)
    const report = optimizer.getEfficiencyReport()
    expect(report.totalJobs).toBe(1)
    expect(report.avgWaitMs).toBe(480)
  })

  it('감사 로그 복사본 반환', () => {
    optimizer.optimize(4, 1024)
    const log = optimizer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', detail: {} })
    expect(optimizer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
