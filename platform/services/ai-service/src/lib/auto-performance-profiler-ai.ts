// Design Ref: §R230 — AI기반 자동 성능 프로파일링
// Plan SC: SVC-AI-ADV-R230-SC01

export interface ProfileTarget {
  targetId: string
  name: string
  type: 'API' | 'BATCH' | 'QUERY' | 'FUNCTION'
}

export interface ProfileSample {
  targetId: string
  executionMs: number
  memoryMb: number
  cpuPercent: number
  timestamp: number
}

export type BottleneckType = 'CPU_BOUND' | 'MEMORY_BOUND' | 'IO_BOUND' | 'NONE'

export interface ProfileReport {
  targetId: string
  sampleCount: number
  avgExecutionMs: number
  p99ExecutionMs: number
  avgMemoryMb: number
  avgCpuPercent: number
  bottleneckType: BottleneckType
  optimizationSuggestions: string[]
  profiledAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  targetId: string
  detail: Record<string, unknown>
}

export class AutoPerformanceProfilerAI {
  private targets = new Map<string, ProfileTarget>()
  private samples = new Map<string, ProfileSample[]>()
  private auditLog: AuditEntry[] = []

  registerTarget(target: ProfileTarget): void {
    this.targets.set(target.targetId, target)
    this.samples.set(target.targetId, [])
    this.appendAudit('target.register', target.targetId, { type: target.type })
  }

  addSample(sample: ProfileSample): void {
    if (!this.targets.has(sample.targetId)) throw new Error(`Unknown target: ${sample.targetId}`)
    const list = this.samples.get(sample.targetId) ?? []
    list.push(sample)
    this.samples.set(sample.targetId, list)
  }

  profile(targetId: string): ProfileReport {
    if (!this.targets.has(targetId)) throw new Error(`Unknown target: ${targetId}`)

    const sampleList = this.samples.get(targetId) ?? []
    this.appendAudit('profile.start', targetId, { sampleCount: sampleList.length })

    if (sampleList.length === 0) {
      return {
        targetId,
        sampleCount: 0,
        avgExecutionMs: 0,
        p99ExecutionMs: 0,
        avgMemoryMb: 0,
        avgCpuPercent: 0,
        bottleneckType: 'NONE',
        optimizationSuggestions: ['샘플 데이터 수집 필요'],
        profiledAt: new Date().toISOString(),
      }
    }

    const n = sampleList.length
    const avgExecutionMs = sampleList.reduce((s, x) => s + x.executionMs, 0) / n
    const avgMemoryMb = sampleList.reduce((s, x) => s + x.memoryMb, 0) / n
    const avgCpuPercent = sampleList.reduce((s, x) => s + x.cpuPercent, 0) / n

    const sortedMs = [...sampleList].sort((a, b) => a.executionMs - b.executionMs)
    const p99Index = Math.floor(n * 0.99)
    const p99ExecutionMs = sortedMs[p99Index]?.executionMs ?? sortedMs[n - 1]?.executionMs ?? 0

    const suggestions: string[] = []
    let bottleneckType: BottleneckType = 'NONE'

    if (avgCpuPercent >= 80) {
      bottleneckType = 'CPU_BOUND'
      suggestions.push('CPU 집약 로직 비동기 처리 또는 분산 처리 권장')
    } else if (avgMemoryMb >= 512) {
      bottleneckType = 'MEMORY_BOUND'
      suggestions.push('메모리 사용 최적화 — 스트리밍 처리 또는 배치 크기 축소 검토')
    } else if (avgExecutionMs >= 1000) {
      bottleneckType = 'IO_BOUND'
      suggestions.push('I/O 대기 시간 최소화 — 캐시 도입 또는 DB 인덱스 최적화 권장')
    }

    if (p99ExecutionMs > avgExecutionMs * 5) {
      suggestions.push(`P99 레이턴시 이상 (${p99ExecutionMs.toFixed(0)}ms) — 타임아웃 설정 및 이상치 조사 필요`)
    }

    this.appendAudit('profile.complete', targetId, { bottleneckType, avgExecutionMs })

    return {
      targetId,
      sampleCount: n,
      avgExecutionMs,
      p99ExecutionMs,
      avgMemoryMb,
      avgCpuPercent,
      bottleneckType,
      optimizationSuggestions: suggestions,
      profiledAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, targetId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, targetId, detail })
  }
}
