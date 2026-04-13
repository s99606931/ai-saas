// Design Ref: §R460 — AI기반 공공기관 업무 흐름 최적화 v2
// Plan SC: SVC-AI-ADV-R460-SC01

export type StepType = 'MANUAL' | 'AUTOMATED' | 'APPROVAL' | 'NOTIFICATION' | 'DECISION'
export type OptimizationSuggestionType = 'AUTOMATE' | 'MERGE' | 'REORDER' | 'ELIMINATE' | 'PARALLELIZE'

export interface WorkflowStep {
  stepId: string
  name: string
  type: StepType
  avgDurationMinutes: number
  errorRate: number    // 0..1
  bottleneck: boolean
}

export interface Workflow {
  workflowId: string
  name: string
  steps: WorkflowStep[]
  avgCycleDays: number
}

export interface WorkflowOptimizationResult {
  workflowId: string
  totalSteps: number
  bottleneckSteps: WorkflowStep[]
  suggestions: Array<{
    type: OptimizationSuggestionType
    stepId?: string
    detail: string
    estimatedSavingMinutes: number
  }>
  estimatedTotalSavingMinutes: number
  automationPotential: number   // 0..1 (자동화 가능 비율)
}

interface AuditEntry {
  timestamp: string
  action: string
  workflowId: string
  detail: Record<string, unknown>
}

export class WorkflowOptimizerV2 {
  private workflows = new Map<string, Workflow>()
  private auditLog: AuditEntry[] = []

  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.workflowId, workflow)
    this.appendAudit('workflow.register', workflow.workflowId, { name: workflow.name, stepCount: workflow.steps.length })
  }

  optimize(workflowId: string): WorkflowOptimizationResult {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) throw new Error(`Unknown workflow: ${workflowId}`)

    this.appendAudit('workflow.optimize', workflowId, { stepCount: workflow.steps.length })

    const suggestions: WorkflowOptimizationResult['suggestions'] = []
    const bottleneckSteps = workflow.steps.filter((s) => s.bottleneck)

    // 자동화 가능 수동 단계 탐지
    const manualSteps = workflow.steps.filter((s) => s.type === 'MANUAL')
    const automatable = manualSteps.filter((s) => s.errorRate < 0.1 && !s.bottleneck)
    for (const step of automatable) {
      suggestions.push({
        type: 'AUTOMATE',
        stepId: step.stepId,
        detail: `'${step.name}' 수동 단계 자동화 가능 — 오류율 ${(step.errorRate * 100).toFixed(0)}% 낮음`,
        estimatedSavingMinutes: Math.round(step.avgDurationMinutes * 0.7),
      })
    }

    // 병목 단계 처리
    for (const step of bottleneckSteps) {
      if (step.type === 'APPROVAL') {
        suggestions.push({
          type: 'PARALLELIZE',
          stepId: step.stepId,
          detail: `'${step.name}' 승인 단계 병렬 처리 권장`,
          estimatedSavingMinutes: Math.round(step.avgDurationMinutes * 0.5),
        })
      } else {
        suggestions.push({
          type: 'REORDER',
          stepId: step.stepId,
          detail: `'${step.name}' 병목 단계 순서 조정 또는 분리 권장`,
          estimatedSavingMinutes: Math.round(step.avgDurationMinutes * 0.3),
        })
      }
    }

    // 고오류율 단계 탐지 (10% 이상)
    const highErrorSteps = workflow.steps.filter((s) => s.errorRate >= 0.1 && !s.bottleneck)
    for (const step of highErrorSteps) {
      suggestions.push({
        type: 'ELIMINATE',
        stepId: step.stepId,
        detail: `'${step.name}' 오류율 ${(step.errorRate * 100).toFixed(0)}% — 단계 재설계 또는 제거 검토`,
        estimatedSavingMinutes: Math.round(step.avgDurationMinutes * step.errorRate * 60),
      })
    }

    const estimatedTotalSavingMinutes = suggestions.reduce((s, sg) => s + sg.estimatedSavingMinutes, 0)
    const automationPotential = workflow.steps.length > 0
      ? automatable.length / workflow.steps.length
      : 0

    return {
      workflowId,
      totalSteps: workflow.steps.length,
      bottleneckSteps,
      suggestions,
      estimatedTotalSavingMinutes,
      automationPotential,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, workflowId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, workflowId, detail })
  }
}
