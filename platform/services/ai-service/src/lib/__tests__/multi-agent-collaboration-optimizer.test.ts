// Plan SC: SVC-AI-ADV-R384
import { describe, it, expect, beforeEach } from 'vitest'
import { MultiAgentCollaborationOptimizer } from '../multi-agent-collaboration-optimizer'

describe('MultiAgentCollaborationOptimizer', () => {
  let optimizer: MultiAgentCollaborationOptimizer

  beforeEach(() => {
    optimizer = new MultiAgentCollaborationOptimizer()
  })

  it('registerAgent — 감사 로그에 agent.register 기록', () => {
    optimizer.registerAgent('agent-1', 'Worker A', 10)
    const log = optimizer.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('agent.register')
    expect(log[0]!.detail).toBe('agent-1')
  })

  it('getAgentUtilization — 부하율 계산', () => {
    optimizer.registerAgent('agent-1', 'Worker A', 10)
    optimizer.assignTask('agent-1', 'task-1', 100)
    optimizer.assignTask('agent-1', 'task-2', 200)
    const result = optimizer.getAgentUtilization('agent-1')
    // completedTasks=2, maxCapacity=10, utilizationRate=20%
    expect(result.completedTasks).toBe(2)
    expect(result.utilizationRate).toBe(20)
  })

  it('getCollaborationEfficiency — 전체 협업 효율 계산', () => {
    optimizer.registerAgent('agent-1', 'Worker A', 10)
    optimizer.registerAgent('agent-2', 'Worker B', 10)
    optimizer.assignTask('agent-1', 'task-1', 100)
    optimizer.assignTask('agent-2', 'task-2', 150)
    optimizer.assignTask('agent-2', 'task-3', 200)
    // totalCompleted=3, totalCapacity=20 → 3/20*100 = 15
    expect(optimizer.getCollaborationEfficiency()).toBe(15)
  })

  it('getCollaborationEfficiency — 에이전트 없을 때 0', () => {
    expect(optimizer.getCollaborationEfficiency()).toBe(0)
  })

  it('getAgentUtilization — 작업 없을 때 utilizationRate=0', () => {
    optimizer.registerAgent('agent-1', 'Worker A', 10)
    const result = optimizer.getAgentUtilization('agent-1')
    expect(result.utilizationRate).toBe(0)
    expect(result.completedTasks).toBe(0)
  })

  it('assignTask — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    optimizer.registerAgent('agent-1', 'Worker A', 10)
    expect(() => optimizer.assignTask('agent-1', 'task-1', 100, 'C')).toThrow('BLOCKED')
  })

  it('assignTask — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    optimizer.registerAgent('agent-1', 'Worker A', 10)
    expect(() => optimizer.assignTask('agent-1', 'task-1', 100, 'S')).toThrow('N2SF N-05')
  })

  it('assignTask — 없는 agentId 에러', () => {
    expect(() => optimizer.assignTask('nonexistent', 'task-1', 100)).toThrow('agentId 없음')
  })
})
