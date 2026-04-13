import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentWorkflowOptimizerAi, type Workflow } from '../intelligent-workflow-optimizer-ai'

describe('IntelligentWorkflowOptimizerAi', () => {
  let optimizer: IntelligentWorkflowOptimizerAi

  const workflow: Workflow = {
    workflowId: 'WF001',
    name: '민원 처리 워크플로우',
    department: '민원과',
    steps: [
      { stepId: 'S1', name: '접수', avgDurationMs: 1000, isParallelizable: false, dependsOn: [] },
      { stepId: 'S2', name: '문서검토', avgDurationMs: 2000, isParallelizable: true, dependsOn: [] },
      { stepId: 'S3', name: '승인', avgDurationMs: 3000, isParallelizable: true, dependsOn: [] },
      { stepId: 'S4', name: '통보', avgDurationMs: 500, isParallelizable: false, dependsOn: ['S3'] },
    ],
  }

  beforeEach(() => {
    optimizer = new IntelligentWorkflowOptimizerAi()
    optimizer.registerWorkflow(workflow)
  })

  it('워크플로우 등록 감사 로그', () => {
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'workflow.register')).toBe(true)
  })

  it('병렬화로 소요시간 단축', () => {
    const plan = optimizer.optimize('WF001')
    expect(plan.optimizedDurationMs).toBeLessThan(plan.originalDurationMs)
  })

  it('원본 소요시간 = 모든 단계 합산', () => {
    const plan = optimizer.optimize('WF001')
    expect(plan.originalDurationMs).toBe(1000 + 2000 + 3000 + 500)
  })

  it('병렬 그룹 구성 확인', () => {
    const plan = optimizer.optimize('WF001')
    expect(plan.parallelGroups.length).toBeGreaterThan(0)
  })

  it('병목 단계 식별 (최장 단계)', () => {
    const plan = optimizer.optimize('WF001')
    expect(plan.bottleneckStepId).toBe('S3')
  })

  it('절감율 > 0', () => {
    const plan = optimizer.optimize('WF001')
    expect(plan.savingPercent).toBeGreaterThan(0)
  })

  it('미등록 워크플로우 에러', () => {
    expect(() => optimizer.optimize('UNKNOWN')).toThrow()
  })

  it('최적화 후 감사 로그', () => {
    optimizer.optimize('WF001')
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'workflow.optimize')).toBe(true)
  })
})
