# SVC-AI-ADV-R165 — 배치 처리 최적화기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export type JobPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW'
export type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'

export interface BatchJob {
  jobId: string; name: string; priority: JobPriority
  estimatedMs: number; requiredCpu: number; requiredMemoryMb: number }

export interface JobResult {
  jobId: string; actualMs: number; cpuUsed: number; memoryUsed: number
  status: JobStatus; completedAt: string }

export interface Schedule { order: BatchJob[]; estimatedTotalMs: number }

export interface EfficiencyReport {
  totalJobs: number; avgWaitMs: number; avgCpuUtilization: number
  avgMemoryUtilization: number; generatedAt: string }

class BatchProcessingOptimizer {
  registerJob(job: BatchJob): void
  optimize(availableCpu: number, availableMemoryMb: number): Schedule
  recordResult(result: JobResult): void
  getEfficiencyReport(): EfficiencyReport
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘

- 우선순위 정렬: CRITICAL(0) > HIGH(1) > NORMAL(2) > LOW(3), 동순위는 estimatedMs 오름차순
- 자원 제약: requiredCpu ≤ availableCpu && requiredMemoryMb ≤ availableMemoryMb 인 잡만 포함
- avgCpuUtilization: 완료 잡들의 cpuUsed / availableCpu 평균
