// Plan SC: SVC-AI-ADV-R460-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowOptimizerV2, type Workflow } from '../workflow-optimizer-v2'

describe('WorkflowOptimizerV2', () => {
  let optimizer: WorkflowOptimizerV2

  const baseWorkflow: Workflow = {
    workflowId: 'WF-1',
    name: '민원 처리 워크플로우',
    avgCycleDays: 5,
    steps: [
      { stepId: 'S1', name: '접수', type: 'MANUAL', avgDurationMinutes: 30, errorRate: 0.02, bottleneck: false },
      { stepId: 'S2', name: '검토 승인', type: 'APPROVAL', avgDurationMinutes: 120, errorRate: 0.05, bottleneck: true },
      { stepId: 'S3', name: '알림 발송', type: 'MANUAL', avgDurationMinutes: 10, errorRate: 0.01, bottleneck: false },
    ],
  }

  beforeEach(() => {
    optimizer = new WorkflowOptimizerV2()
  })

  it('미등록 워크플로우 최적화 시 오류 발생', () => {
    expect(() => optimizer.optimize('UNKNOWN')).toThrow('Unknown workflow')
  })

  it('수동 단계 낮은 오류율 → AUTOMATE 제안', () => {
    optimizer.registerWorkflow(baseWorkflow)
    const result = optimizer.optimize('WF-1')
    const autoSuggestion = result.suggestions.find((s) => s.type === 'AUTOMATE' && s.stepId === 'S1')
    expect(autoSuggestion).toBeDefined()
    expect(autoSuggestion!.estimatedSavingMinutes).toBeGreaterThan(0)
  })

  it('병목 APPROVAL 단계 → PARALLELIZE 제안', () => {
    optimizer.registerWorkflow(baseWorkflow)
    const result = optimizer.optimize('WF-1')
    const parallelSuggestion = result.suggestions.find((s) => s.type === 'PARALLELIZE' && s.stepId === 'S2')
    expect(parallelSuggestion).toBeDefined()
  })

  it('bottleneckSteps에 병목 단계 포함', () => {
    optimizer.registerWorkflow(baseWorkflow)
    const result = optimizer.optimize('WF-1')
    expect(result.bottleneckSteps.some((s) => s.stepId === 'S2')).toBe(true)
  })

  it('고오류율 비병목 단계 → ELIMINATE 제안', () => {
    optimizer.registerWorkflow({
      ...baseWorkflow,
      workflowId: 'WF-ERR',
      steps: [
        { stepId: 'E1', name: '오류 다발 단계', type: 'MANUAL', avgDurationMinutes: 60, errorRate: 0.2, bottleneck: false },
      ],
    })
    const result = optimizer.optimize('WF-ERR')
    expect(result.suggestions.some((s) => s.type === 'ELIMINATE' && s.stepId === 'E1')).toBe(true)
  })

  it('estimatedTotalSavingMinutes는 개별 합산과 일치', () => {
    optimizer.registerWorkflow(baseWorkflow)
    const result = optimizer.optimize('WF-1')
    const sum = result.suggestions.reduce((s, sg) => s + sg.estimatedSavingMinutes, 0)
    expect(result.estimatedTotalSavingMinutes).toBe(sum)
  })

  it('automationPotential: 자동화 가능 단계 비율', () => {
    optimizer.registerWorkflow(baseWorkflow)
    const result = optimizer.optimize('WF-1')
    // S1, S3 중 S1만 자동화 가능 (S3도 MANUAL, errorRate<0.1, bottleneck=false → 자동화 가능)
    expect(result.automationPotential).toBeGreaterThan(0)
    expect(result.automationPotential).toBeLessThanOrEqual(1)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    optimizer.registerWorkflow(baseWorkflow)
    optimizer.optimize('WF-1')
    const log1 = optimizer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', workflowId: 'X', detail: {} })
    const log2 = optimizer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
