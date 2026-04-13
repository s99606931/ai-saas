import { describe, it, expect, beforeEach } from 'vitest'
import { PublicTaskAutomationAi, type AutomationTask, type TaskExecutionRequest } from '../public-task-automation-ai'

describe('PublicTaskAutomationAi', () => {
  let automation: PublicTaskAutomationAi

  const task: AutomationTask = {
    taskId: 'TASK001',
    taskName: '민원 자동 분류',
    department: '민원처리과',
    triggerType: 'EVENT',
    dataGrade: 'O',
    steps: [
      { stepId: 'S1', action: '민원 데이터 수집', inputFields: ['complaintId'], requiresApproval: false },
      { stepId: 'S2', action: '자동 분류', inputFields: ['category'], requiresApproval: false },
    ],
  }

  const request: TaskExecutionRequest = {
    taskId: 'TASK001',
    triggeredBy: 'USR0012345',
    inputData: { complaintId: 'CMP001' },
  }

  beforeEach(() => {
    automation = new PublicTaskAutomationAi()
    automation.registerTask(task)
  })

  it('C/S 등급 업무 등록 차단', () => {
    expect(() => automation.registerTask({ ...task, taskId: 'TASK_C', dataGrade: 'C' })).toThrow('BLOCKED')
    expect(() => automation.registerTask({ ...task, taskId: 'TASK_S', dataGrade: 'S' })).toThrow('BLOCKED')
  })

  it('승인 불필요 단계만 있으면 → COMPLETED', () => {
    const result = automation.execute(request)
    expect(result.status).toBe('COMPLETED')
    expect(result.completedSteps).toBe(2)
  })

  it('승인 필요 단계 있으면 → PENDING_APPROVAL', () => {
    const taskWithApproval: AutomationTask = {
      ...task,
      taskId: 'TASK002',
      steps: [
        { stepId: 'S1', action: '데이터 수집', inputFields: [], requiresApproval: false },
        { stepId: 'S2', action: '결재 요청', inputFields: [], requiresApproval: true },
      ],
    }
    automation.registerTask(taskWithApproval)
    const result = automation.execute({ ...request, taskId: 'TASK002' })
    expect(result.status).toBe('PENDING_APPROVAL')
  })

  it('triggeredBy userId 마스킹', () => {
    const result = automation.execute(request)
    expect(result.maskedTriggeredBy).not.toBe(request.triggeredBy)
    expect(result.maskedTriggeredBy.includes('*')).toBe(true)
  })

  it('미등록 태스크 에러', () => {
    expect(() => automation.execute({ ...request, taskId: 'UNKNOWN' })).toThrow()
  })

  it('실행 후 감사 로그', () => {
    automation.execute(request)
    const log = automation.getAuditLog()
    expect(log.some((e) => e.action === 'task.execute')).toBe(true)
  })
})
