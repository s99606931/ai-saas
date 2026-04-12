/**
 * Serverless Cost Optimizer — SVC-AI-ADV-R170 (트랙 B 4차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R170/SVC-AI-ADV-R170.design.md
 * Plan SC: FR-R170.1 ~ FR-R170.5
 *
 * 함수 실행 기록 → 비용 계산 → 최적화 제안 → 절감 리포트.
 * 순수 계산 — 외부 API 없음.
 */

// Design Ref: §타입 정의

export interface FunctionExecution {
  functionId: string
  timestamp: number
  durationMs: number
  memoryMb: number
  coldStart: boolean
}

export interface CostBreakdown {
  functionId: string
  totalInvocations: number
  totalDurationMs: number
  avgMemoryMb: number
  estimatedCost: number
  currency: string
}

export interface OptimizationSuggestion {
  functionId: string
  type: 'MEMORY_OVERALLOC' | 'COLDSTART_HIGH' | 'DURATION_HIGH'
  currentValue: number
  recommendedValue: number
  estimatedSavingPct: number
  description: string
}

export interface SavingsReport {
  functionId: string
  currentCost: number
  optimizedCost: number
  savingPct: number
  suggestions: OptimizationSuggestion[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  functionId: string
  detail: Record<string, unknown>
}

export class ServerlessCostOptimizer {
  private readonly executions = new Map<string, FunctionExecution[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R170.1
  recordExecution(exec: FunctionExecution): void {
    if (!this.executions.has(exec.functionId)) {
      this.executions.set(exec.functionId, [])
    }
    this.executions.get(exec.functionId)!.push({ ...exec })
  }

  // Plan SC: FR-R170.2 — Design Ref: §알고리즘 비용 계산
  calculateCost(functionId: string): CostBreakdown {
    const execs = this.executions.get(functionId) ?? []
    const totalInvocations = execs.length
    const totalDurationMs = execs.reduce((s, e) => s + e.durationMs, 0)
    const avgMemoryMb = totalInvocations === 0 ? 0 : execs.reduce((s, e) => s + e.memoryMb, 0) / totalInvocations

    // 비용: (totalDurationMs / 100) × (avgMemoryMb / 128) × 0.0000002
    const estimatedCost = (totalDurationMs / 100) * (avgMemoryMb / 128) * 0.0000002

    const breakdown: CostBreakdown = {
      functionId,
      totalInvocations,
      totalDurationMs,
      avgMemoryMb: Math.round(avgMemoryMb),
      estimatedCost: Math.round(estimatedCost * 10000000) / 10000000,
      currency: 'KRW',
    }
    this.appendAudit('cost.calculate', functionId, { totalInvocations, estimatedCost: breakdown.estimatedCost })
    return breakdown
  }

  // Plan SC: FR-R170.3 — Design Ref: §알고리즘 최적화 제안
  suggestOptimizations(functionId: string): OptimizationSuggestion[] {
    const execs = this.executions.get(functionId) ?? []
    if (execs.length === 0) return []

    const suggestions: OptimizationSuggestion[] = []
    const avgMemoryMb = execs.reduce((s, e) => s + e.memoryMb, 0) / execs.length
    const coldStartRate = execs.filter((e) => e.coldStart).length / execs.length
    const avgDurationMs = execs.reduce((s, e) => s + e.durationMs, 0) / execs.length

    // 메모리 과할당
    if (avgMemoryMb > 512) {
      const recommended = Math.ceil(avgMemoryMb * 0.7)
      suggestions.push({
        functionId,
        type: 'MEMORY_OVERALLOC',
        currentValue: Math.round(avgMemoryMb),
        recommendedValue: recommended,
        estimatedSavingPct: Math.round((1 - recommended / avgMemoryMb) * 100),
        description: `평균 메모리 ${Math.round(avgMemoryMb)}MB → ${recommended}MB로 축소 권장`,
      })
    }

    // 콜드스타트
    if (coldStartRate > 0.3) {
      suggestions.push({
        functionId,
        type: 'COLDSTART_HIGH',
        currentValue: Math.round(coldStartRate * 100),
        recommendedValue: 10,
        estimatedSavingPct: 15,
        description: `콜드스타트 비율 ${Math.round(coldStartRate * 100)}% — Provisioned Concurrency 설정 권장`,
      })
    }

    // 실행 시간
    if (avgDurationMs > 3000) {
      suggestions.push({
        functionId,
        type: 'DURATION_HIGH',
        currentValue: Math.round(avgDurationMs),
        recommendedValue: 1000,
        estimatedSavingPct: Math.round((1 - 1000 / avgDurationMs) * 100),
        description: `평균 실행 시간 ${Math.round(avgDurationMs)}ms — 로직 최적화 권장`,
      })
    }

    this.appendAudit('optimize.suggest', functionId, { suggestionCount: suggestions.length })
    return suggestions
  }

  // Plan SC: FR-R170.4 — 절감 리포트
  generateSavingsReport(functionId: string): SavingsReport | null {
    const execs = this.executions.get(functionId)
    if (!execs || execs.length === 0) return null

    const cost = this.calculateCost(functionId)
    const suggestions = this.suggestOptimizations(functionId)

    // 절감 예상: 메모리 제안이 있으면 메모리 비율로 감소
    const memorySuggestion = suggestions.find((s) => s.type === 'MEMORY_OVERALLOC')
    const savingRate = memorySuggestion ? memorySuggestion.estimatedSavingPct / 100 : 0
    const optimizedCost = cost.estimatedCost * (1 - savingRate)
    const savingPct = cost.estimatedCost === 0 ? 0 : Math.round(savingRate * 100)

    return {
      functionId,
      currentCost: cost.estimatedCost,
      optimizedCost: Math.round(optimizedCost * 10000000) / 10000000,
      savingPct,
      suggestions,
    }
  }

  // Plan SC: FR-R170.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, functionId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, functionId, detail })
  }
}
