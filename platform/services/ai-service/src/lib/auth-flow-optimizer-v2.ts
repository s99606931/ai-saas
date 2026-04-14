// Design Ref: §R611 — AI기반 자동 인증 흐름 최적화 v2
// Plan SC: SVC-AI-ADV-R611-SC01

export type StepStatus = 'NORMAL' | 'BOTTLENECK' | 'HIGH_FAILURE'
export type FlowOptimizationAction = 'CACHE_CREDENTIALS' | 'PARALLEL_STEPS' | 'REMOVE_REDUNDANT' | 'ADD_MFA' | 'NONE'

export interface AuthStep {
  stepId: string
  name: string
  avgTimeMs: number
  failRate: number  // 0..100 (%)
  optional: boolean
}

export interface AuthFlow {
  flowId: string
  name: string
  steps: AuthStep[]
}

export interface StepAnalysis {
  stepId: string
  name: string
  avgTimeMs: number
  failRate: number
  status: StepStatus
  issues: string[]
}

export interface FlowAnalysis {
  flowId: string
  name: string
  totalAvgTimeMs: number
  stepAnalyses: StepAnalysis[]
  bottleneckCount: number
  highFailureCount: number
}

export interface FlowOptimization {
  flowId: string
  name: string
  recommendations: { action: FlowOptimizationAction; reason: string; stepId?: string }[]
  estimatedTimeSavingMs: number
}

interface AuditEntry {
  timestamp: string
  action: string
  flowId: string
  detail: Record<string, unknown>
}

export class AuthFlowOptimizerV2 {
  private flows = new Map<string, AuthFlow>()
  private auditLog: AuditEntry[] = []

  registerFlow(flow: AuthFlow): void {
    this.flows.set(flow.flowId, flow)
    this.appendAudit('flow.register', flow.flowId, { name: flow.name, steps: flow.steps.length })
  }

  analyze(flowId: string): FlowAnalysis {
    const flow = this.flows.get(flowId)
    if (!flow) throw new Error(`Unknown flow: ${flowId}`)

    const stepAnalyses: StepAnalysis[] = flow.steps.map((step) => {
      const issues: string[] = []
      let status: StepStatus = 'NORMAL'

      if (step.avgTimeMs > 1000) {
        issues.push(`평균 응답시간 ${step.avgTimeMs}ms — 병목 단계`)
        status = 'BOTTLENECK'
      }
      if (step.failRate > 5) {
        issues.push(`실패율 ${step.failRate.toFixed(1)}% — 높은 실패율`)
        status = status === 'BOTTLENECK' ? 'HIGH_FAILURE' : 'HIGH_FAILURE'
      }

      return { stepId: step.stepId, name: step.name, avgTimeMs: step.avgTimeMs, failRate: step.failRate, status, issues }
    })

    const totalAvgTimeMs = flow.steps.reduce((s, step) => s + step.avgTimeMs, 0)
    const bottleneckCount = stepAnalyses.filter((s) => s.status === 'BOTTLENECK').length
    const highFailureCount = stepAnalyses.filter((s) => s.status === 'HIGH_FAILURE').length

    this.appendAudit('flow.analyze', flowId, { totalAvgTimeMs, bottleneckCount, highFailureCount })
    return { flowId, name: flow.name, totalAvgTimeMs, stepAnalyses, bottleneckCount, highFailureCount }
  }

  optimize(flowId: string): FlowOptimization {
    const analysis = this.analyze(flowId)
    const flow = this.flows.get(flowId)
    if (!flow) throw new Error(`Unknown flow: ${flowId}`)

    const recommendations: FlowOptimization['recommendations'] = []
    let estimatedTimeSavingMs = 0

    for (const sa of analysis.stepAnalyses) {
      if (sa.status === 'BOTTLENECK') {
        recommendations.push({ action: 'CACHE_CREDENTIALS', reason: `${sa.name} 병목 — 자격증명 캐싱으로 ${sa.avgTimeMs - 200}ms 단축 예상`, stepId: sa.stepId })
        estimatedTimeSavingMs += sa.avgTimeMs - 200
      }
      if (sa.status === 'HIGH_FAILURE') {
        recommendations.push({ action: 'ADD_MFA', reason: `${sa.name} 실패율 ${sa.failRate.toFixed(1)}% — MFA 추가로 안전성 강화`, stepId: sa.stepId })
      }
    }

    const optionalSteps = flow.steps.filter((s) => s.optional)
    if (optionalSteps.length > 0) {
      recommendations.push({ action: 'REMOVE_REDUNDANT', reason: `선택 단계 ${optionalSteps.length}개 제거 가능` })
      estimatedTimeSavingMs += optionalSteps.reduce((s, step) => s + step.avgTimeMs, 0)
    }

    if (recommendations.length === 0) {
      recommendations.push({ action: 'NONE', reason: '현재 인증 흐름 최적 상태' })
    }

    this.appendAudit('flow.optimize', flowId, { recommendations: recommendations.length, estimatedTimeSavingMs })
    return { flowId, name: flow.name, recommendations, estimatedTimeSavingMs }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, flowId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, flowId, detail })
  }
}
