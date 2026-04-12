/**
 * Batch Processing Optimizer — SVC-AI-ADV-R165 (트랙 B 4차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R165/SVC-AI-ADV-R165.design.md
 * Plan SC: FR-R165.1 ~ FR-R165.5
 *
 * 배치 잡 우선순위 + 자원 제약 기반 최적 실행 순서 결정.
 * 순수 계산 — 외부 API 없음.
 */

// Design Ref: §타입 정의

export type JobPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW'
export type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'

export interface BatchJob {
  jobId: string
  name: string
  priority: JobPriority
  estimatedMs: number
  requiredCpu: number
  requiredMemoryMb: number
}

export interface JobResult {
  jobId: string
  actualMs: number
  cpuUsed: number
  memoryUsed: number
  status: JobStatus
  completedAt: string
}

export interface Schedule {
  order: BatchJob[]
  estimatedTotalMs: number
}

export interface EfficiencyReport {
  totalJobs: number
  avgWaitMs: number
  avgCpuUtilization: number
  avgMemoryUtilization: number
  generatedAt: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

// Design Ref: §알고리즘 — 우선순위 정렬 순서
const PRIORITY_ORDER: Record<JobPriority, number> = {
  CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3,
}

export class BatchProcessingOptimizer {
  private readonly jobs = new Map<string, BatchJob>()
  private readonly results: JobResult[] = []
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R165.1
  registerJob(job: BatchJob): void {
    this.jobs.set(job.jobId, { ...job })
    this.appendAudit('job.register', { jobId: job.jobId, priority: job.priority })
  }

  // Plan SC: FR-R165.2 — Design Ref: §알고리즘 우선순위 + 자원 제약
  optimize(availableCpu: number, availableMemoryMb: number): Schedule {
    const eligible = [...this.jobs.values()].filter(
      (j) => j.requiredCpu <= availableCpu && j.requiredMemoryMb <= availableMemoryMb,
    )

    // 우선순위 오름차순, 동순위는 estimatedMs 오름차순
    const sorted = eligible.sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      return pd !== 0 ? pd : a.estimatedMs - b.estimatedMs
    })

    const estimatedTotalMs = sorted.reduce((sum, j) => sum + j.estimatedMs, 0)
    this.appendAudit('optimize', { jobCount: sorted.length, estimatedTotalMs })
    return { order: sorted.map((j) => ({ ...j })), estimatedTotalMs }
  }

  // Plan SC: FR-R165.3
  recordResult(result: JobResult): void {
    this.results.push({ ...result })
    this.appendAudit('result.record', { jobId: result.jobId, status: result.status, actualMs: result.actualMs })
  }

  // Plan SC: FR-R165.4 — Design Ref: §알고리즘 효율 리포트
  getEfficiencyReport(): EfficiencyReport {
    const done = this.results.filter((r) => r.status === 'DONE')
    const totalJobs = this.results.length
    const avgWaitMs = done.length === 0 ? 0 : done.reduce((s, r) => s + r.actualMs, 0) / done.length
    const avgCpuUtilization = done.length === 0 ? 0 : done.reduce((s, r) => s + r.cpuUsed, 0) / done.length
    const avgMemoryUtilization = done.length === 0 ? 0 : done.reduce((s, r) => s + r.memoryUsed, 0) / done.length

    return {
      totalJobs,
      avgWaitMs: Math.round(avgWaitMs),
      avgCpuUtilization: Math.round(avgCpuUtilization * 100) / 100,
      avgMemoryUtilization: Math.round(avgMemoryUtilization),
      generatedAt: new Date().toISOString(),
    }
  }

  // Plan SC: FR-R165.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
