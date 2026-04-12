// Design Ref: §R237 — AI기반 서버리스 워크플로우 최적화
// Plan SC: SVC-AI-ADV-R237-SC01

export type FunctionRuntime = 'nodejs' | 'python' | 'java' | 'go'
export type TriggerType = 'HTTP' | 'QUEUE' | 'SCHEDULE' | 'EVENT'
export type OptimizationAction = 'INCREASE_MEMORY' | 'DECREASE_MEMORY' | 'ENABLE_PROVISIONED' | 'DISABLE_PROVISIONED' | 'NO_CHANGE'

export interface FunctionConfig {
  functionId: string
  name: string
  runtime: FunctionRuntime
  memoryMb: number
  timeoutMs: number
  triggerType: TriggerType
}

export interface FunctionInvocation {
  functionId: string
  durationMs: number
  memoryUsedMb: number
  coldStart: boolean
  success: boolean
  timestamp: number
}

export interface WorkflowOptimization {
  functionId: string
  action: OptimizationAction
  currentMemoryMb: number
  recommendedMemoryMb: number
  avgDurationMs: number
  coldStartRate: number
  estimatedCostSaving: number  // %
  reason: string
}

interface AuditEntry {
  timestamp: string
  action: string
  functionId: string
  detail: Record<string, unknown>
}

export class ServerlessWorkflowOptimizer {
  private functions = new Map<string, FunctionConfig>()
  private invocations = new Map<string, FunctionInvocation[]>()
  private auditLog: AuditEntry[] = []

  registerFunction(config: FunctionConfig): void {
    this.functions.set(config.functionId, config)
    this.invocations.set(config.functionId, [])
    this.appendAudit('function.register', config.functionId, { name: config.name, runtime: config.runtime })
  }

  recordInvocation(inv: FunctionInvocation): void {
    if (!this.functions.has(inv.functionId)) throw new Error(`Unknown function: ${inv.functionId}`)
    const list = this.invocations.get(inv.functionId) ?? []
    list.push(inv)
    this.invocations.set(inv.functionId, list)
  }

  optimize(functionId: string): WorkflowOptimization {
    const fn = this.functions.get(functionId)
    if (!fn) throw new Error(`Unknown function: ${functionId}`)

    const history = this.invocations.get(functionId) ?? []
    if (history.length === 0) {
      return {
        functionId,
        action: 'NO_CHANGE',
        currentMemoryMb: fn.memoryMb,
        recommendedMemoryMb: fn.memoryMb,
        avgDurationMs: 0,
        coldStartRate: 0,
        estimatedCostSaving: 0,
        reason: '호출 데이터 없음',
      }
    }

    const avgDurationMs = history.reduce((s, i) => s + i.durationMs, 0) / history.length
    const avgMemoryUsed = history.reduce((s, i) => s + i.memoryUsedMb, 0) / history.length
    const coldStartRate = history.filter((i) => i.coldStart).length / history.length

    let action: OptimizationAction = 'NO_CHANGE'
    let recommendedMemoryMb = fn.memoryMb
    let estimatedCostSaving = 0
    let reason = '최적 상태'

    const memoryUsageRatio = avgMemoryUsed / fn.memoryMb

    if (memoryUsageRatio < 0.4 && fn.memoryMb > 128) {
      // 메모리 사용률 40% 미만 → 축소 권고
      recommendedMemoryMb = Math.max(128, Math.round(avgMemoryUsed * 1.5 / 64) * 64)
      action = 'DECREASE_MEMORY'
      estimatedCostSaving = Math.round((1 - recommendedMemoryMb / fn.memoryMb) * 100)
      reason = `메모리 사용률 ${Math.round(memoryUsageRatio * 100)}% — 축소 권고`
    } else if (memoryUsageRatio > 0.85) {
      // 메모리 사용률 85% 초과 → 증가 권고
      recommendedMemoryMb = Math.min(10240, fn.memoryMb * 2)
      action = 'INCREASE_MEMORY'
      reason = `메모리 사용률 ${Math.round(memoryUsageRatio * 100)}% — 증가 권고`
    } else if (coldStartRate > 0.3 && fn.triggerType === 'HTTP') {
      // HTTP 트리거 콜드스타트 30% 초과 → Provisioned 권고
      action = 'ENABLE_PROVISIONED'
      reason = `콜드스타트 ${Math.round(coldStartRate * 100)}% — Provisioned Concurrency 권고`
    }

    this.appendAudit('function.optimize', functionId, { action, recommendedMemoryMb, coldStartRate: Math.round(coldStartRate * 100) / 100 })

    return {
      functionId,
      action,
      currentMemoryMb: fn.memoryMb,
      recommendedMemoryMb,
      avgDurationMs: Math.round(avgDurationMs),
      coldStartRate: Math.round(coldStartRate * 100) / 100,
      estimatedCostSaving,
      reason,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, functionId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, functionId, detail })
  }
}
