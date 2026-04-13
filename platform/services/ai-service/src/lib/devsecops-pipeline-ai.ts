// Design Ref: §핵심 알고리즘 — 파이프라인 점수, pass/fail 단계 관리
// Plan SC: SVC-AI-ADV-R345
export type DataGrade = 'O' | 'C' | 'S'

export interface Pipeline {
  id: string
  name: string
  steps: string[]
  stepResults: Map<string, StepResult>
}

export interface StepResult {
  pipelineId: string
  stepName: string
  passed: boolean
  findings: number
}

export interface PipelineResult {
  pipelineId: string
  pipelineScore: number
  pipelineStatus: 'passed' | 'failed'
  passCount: number
  totalSteps: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class DevSecOpsPipelineAI {
  private pipelines = new Map<string, Pipeline>()
  private auditLog: AuditEntry[] = []

  registerPipeline(id: string, name: string, steps: string[]): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    if (!steps || steps.length === 0) throw new Error('steps는 1개 이상 필수')
    this.pipelines.set(id, { id, name, steps: [...steps], stepResults: new Map() })
    this.auditLog.push({ action: 'pipeline.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordStepResult(pipelineId: string, stepName: string, passed: boolean, findings: number, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 파이프라인 데이터 전송 금지 (N2SF N-05)`)
    }
    const pipeline = this.pipelines.get(pipelineId)
    if (!pipeline) throw new Error(`pipelineId 없음: ${pipelineId}`)
    pipeline.stepResults.set(stepName, { pipelineId, stepName, passed, findings })
    this.auditLog.push({ action: 'step.record', timestamp: new Date().toISOString(), detail: `${pipelineId}:${stepName}=${passed}` })
  }

  getPipelineScore(pipelineId: string): PipelineResult {
    const pipeline = this.pipelines.get(pipelineId)
    if (!pipeline) throw new Error(`pipelineId 없음: ${pipelineId}`)
    const totalSteps = pipeline.steps.length
    const passCount = [...pipeline.stepResults.values()].filter((r) => r.passed).length
    const pipelineScore = totalSteps === 0 ? 0 : Math.round((passCount / totalSteps) * 100)
    const hasFail = [...pipeline.stepResults.values()].some((r) => !r.passed)
    return {
      pipelineId,
      pipelineScore,
      pipelineStatus: hasFail ? 'failed' : 'passed',
      passCount,
      totalSteps,
    }
  }

  getFailedSteps(pipelineId: string): StepResult[] {
    const pipeline = this.pipelines.get(pipelineId)
    if (!pipeline) throw new Error(`pipelineId 없음: ${pipelineId}`)
    return [...pipeline.stepResults.values()].filter((r) => !r.passed)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
