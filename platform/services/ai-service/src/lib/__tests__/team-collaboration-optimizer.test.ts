import { describe, it, expect, beforeEach } from 'vitest'
import {
  TeamCollaborationOptimizer,
  type MemberProfile,
  type TaskItem,
} from '../team-collaboration-optimizer'

describe('TeamCollaborationOptimizer', () => {
  let optimizer: TeamCollaborationOptimizer

  const alice: MemberProfile = {
    memberId: 'M01',
    name: 'Alice',
    role: 'Developer',
    skills: ['typescript', 'react'],
    weeklyCapacityHours: 40,
    grade: 'O',
  }
  const bob: MemberProfile = {
    memberId: 'M02',
    name: 'Bob',
    role: 'Developer',
    skills: ['typescript', 'node'],
    weeklyCapacityHours: 40,
    grade: 'O',
  }

  const task: TaskItem = {
    taskId: 'T01',
    title: 'React UI 구현',
    priority: 'HIGH',
    requiredSkills: ['typescript', 'react'],
    estimatedHours: 16,
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
  }

  beforeEach(() => {
    optimizer = new TeamCollaborationOptimizer()
    optimizer.registerMember(alice)
    optimizer.registerMember(bob)
  })

  it('C등급 팀원 등록 차단', () => {
    expect(() =>
      optimizer.registerMember({ ...alice, memberId: 'M03', grade: 'C' })
    ).toThrow('BLOCKED')
  })

  it('0 이하 weeklyCapacity 거부', () => {
    expect(() =>
      optimizer.registerMember({ ...alice, memberId: 'M04', weeklyCapacityHours: 0 })
    ).toThrow('양수')
  })

  it('태스크 등록 후 감사 로그', () => {
    optimizer.registerTask(task)
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'task.register')).toBe(true)
  })

  it('부하 분석 — 미할당 시 UNDERUTILIZED', () => {
    const reports = optimizer.analyzeWorkload()
    expect(reports).toHaveLength(2)
    expect(reports.every((r) => r.status === 'UNDERUTILIZED')).toBe(true)
  })

  it('배분 권고 — 스킬 완전 매칭 우선', () => {
    optimizer.registerTask(task)
    const recs = optimizer.recommendAssignment('T01')
    expect(recs).toHaveLength(2)
    expect(recs[0]?.memberId).toBe('M01')  // Alice가 react 보유
    expect(recs[0]?.skillMatch).toBe(100)
  })

  it('과부하 → OVERLOADED 상태', () => {
    optimizer.registerTask({ ...task, taskId: 'T02', estimatedHours: 50 })
    optimizer.assignTask('T02', 'M01')
    const reports = optimizer.analyzeWorkload()
    const alice = reports.find((r) => r.memberId === 'M01')
    expect(alice?.status).toBe('OVERLOADED')
    expect(alice?.loadRatio).toBeGreaterThan(1)
  })

  it('병목 탐지 — 과부하 CRITICAL', () => {
    optimizer.registerTask({ ...task, taskId: 'T03', estimatedHours: 60 })
    optimizer.assignTask('T03', 'M01')
    const bottlenecks = optimizer.detectBottlenecks()
    expect(bottlenecks.some((b) => b.severity === 'CRITICAL' && b.cause === 'OVERLOAD')).toBe(true)
  })

  it('마감 임박 CRITICAL 태스크 병목', () => {
    const urgent: TaskItem = {
      taskId: 'T04',
      title: '긴급',
      priority: 'CRITICAL',
      requiredSkills: ['typescript'],
      estimatedHours: 8,
      dueDate: new Date(Date.now() + 86400000).toISOString(),  // 1일 후
    }
    optimizer.registerTask(urgent)
    optimizer.assignTask('T04', 'M02')
    const bottlenecks = optimizer.detectBottlenecks()
    expect(bottlenecks.some((b) => b.cause === 'DEADLINE_RISK')).toBe(true)
  })

  it('getAuditLog 불변 반환', () => {
    optimizer.registerTask(task)
    const log1 = optimizer.getAuditLog()
    log1.push({ timestamp: '', action: 'hack', detail: {} })
    const log2 = optimizer.getAuditLog()
    expect(log2.length).toBeLessThan(log1.length)
  })
})
