// Design Ref: §R358 — AI기반 지능형 워크플로우 최적화
// Plan SC: SC-R358

export interface WorkflowStep {
  stepId: string
  name: string
  avgDurationMs: number
  isParallelizable: boolean
  dependsOn: string[]
}

export interface Workflow {
  workflowId: string
  name: string
  department: string
  steps: WorkflowStep[]
}

export interface WorkflowOptimizationPlan {
  workflowId: string
  originalDurationMs: number
  optimizedDurationMs: number
  savingPercent: number
  parallelGroups: string[][]
  bottleneckStepId: string | null
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class IntelligentWorkflowOptimizerAi {
  private workflows = new Map<string, Workflow>()
  private auditLog: AuditEntry[] = []

  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.workflowId, workflow)
    this.auditLog.push({ action: 'workflow.register', timestamp: new Date().toISOString(), detail: workflow.workflowId })
  }

  optimize(workflowId: string): WorkflowOptimizationPlan {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`)

    const steps = workflow.steps
    const originalDurationMs = steps.reduce((s, step) => s + step.avgDurationMs, 0)

    // 병렬화 가능한 그룹 구성: 의존성 없는 단계끼리 병렬 실행
    const parallelGroups: string[][] = []
    const assigned = new Set<string>()

    for (const step of steps) {
      if (assigned.has(step.stepId)) continue
      if (!step.isParallelizable || step.dependsOn.length > 0) {
        parallelGroups.push([step.stepId])
        assigned.add(step.stepId)
        continue
      }
      // 같은 그룹에 병렬 가능한 의존성 없는 단계들 묶기
      const group = [step.stepId]
      assigned.add(step.stepId)
      for (const other of steps) {
        if (assigned.has(other.stepId)) continue
        if (other.isParallelizable && other.dependsOn.length === 0) {
          group.push(other.stepId)
          assigned.add(other.stepId)
        }
      }
      parallelGroups.push(group)
    }

    // 최적화 소요 시간: 각 그룹의 최대값 합산
    const optimizedDurationMs = parallelGroups.reduce((total, group) => {
      const groupMax = group.reduce((max, stepId) => {
        const s = steps.find((st) => st.stepId === stepId)
        return Math.max(max, s?.avgDurationMs ?? 0)
      }, 0)
      return total + groupMax
    }, 0)

    const savingPercent = originalDurationMs > 0
      ? Math.round(((originalDurationMs - optimizedDurationMs) / originalDurationMs) * 100)
      : 0

    // 병목 단계: 가장 오래 걸리는 단계
    const bottleneckStep = steps.reduce((max, s) => s.avgDurationMs > (max?.avgDurationMs ?? 0) ? s : max, steps[0] ?? null)
    const bottleneckStepId = bottleneckStep?.stepId ?? null

    const recommendations: string[] = []
    if (savingPercent > 0) recommendations.push(`병렬 실행으로 ${savingPercent}% 시간 단축 가능`)
    if (bottleneckStepId) recommendations.push(`병목 단계 '${bottleneckStepId}' 최적화 우선 검토`)

    this.auditLog.push({ action: 'workflow.optimize', timestamp: new Date().toISOString(), detail: `${workflowId}:saving=${savingPercent}%` })
    return { workflowId, originalDurationMs, optimizedDurationMs, savingPercent, parallelGroups, bottleneckStepId, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
