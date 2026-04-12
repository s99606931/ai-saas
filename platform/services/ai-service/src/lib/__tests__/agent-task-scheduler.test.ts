/**
 * Tests — SVC-AI-ADV-R127 Agent Task Scheduler (DAG)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  AgentTaskScheduler,
  DataGrade,
} from '../agent-task-scheduler'

describe('AgentTaskScheduler — R127', () => {
  let s: AgentTaskScheduler

  beforeEach(() => {
    s = new AgentTaskScheduler({ maxConcurrency: 2 })
  })

  it('FR-R127.1: 태스크 등록', () => {
    s.registerTask({
      id: 'a',
      dependsOn: [],
      grade: DataGrade.O,
      executor: () => 1,
    })
    expect(() =>
      s.registerTask({
        id: 'a',
        dependsOn: [],
        grade: DataGrade.O,
        executor: () => 1,
      }),
    ).toThrow('Duplicate')
  })

  it('FR-R127.8: C등급 차단', () => {
    expect(() =>
      s.registerTask({
        id: 'x',
        dependsOn: [],
        grade: DataGrade.C,
        executor: () => 1,
      }),
    ).toThrow('BLOCKED')
  })

  it('FR-R127.8: S등급 차단', () => {
    expect(() =>
      s.registerTask({
        id: 'x',
        dependsOn: [],
        grade: DataGrade.S,
        executor: () => 1,
      }),
    ).toThrow('N2SF N-05')
  })

  it('FR-R127.2: 사이클 탐지', async () => {
    s.registerTask({
      id: 'a',
      dependsOn: ['b'],
      grade: DataGrade.O,
      executor: () => 1,
    })
    s.registerTask({
      id: 'b',
      dependsOn: ['a'],
      grade: DataGrade.O,
      executor: () => 2,
    })
    expect(() => s.validateDAG()).toThrow('Cycle')
    await expect(s.run()).rejects.toThrow('Cycle')
  })

  it('알 수 없는 의존성', () => {
    s.registerTask({
      id: 'a',
      dependsOn: ['ghost'],
      grade: DataGrade.O,
      executor: () => 1,
    })
    expect(() => s.validateDAG()).toThrow('unknown')
  })

  it('FR-R127.3/4: 토폴로지 정렬 + 병렬 실행', async () => {
    const order: string[] = []
    s.registerTask({
      id: 'a',
      dependsOn: [],
      grade: DataGrade.O,
      executor: async () => {
        order.push('a-start')
        await new Promise((r) => setTimeout(r, 10))
        order.push('a-end')
        return 'A'
      },
    })
    s.registerTask({
      id: 'b',
      dependsOn: [],
      grade: DataGrade.O,
      executor: async () => {
        order.push('b-start')
        await new Promise((r) => setTimeout(r, 10))
        order.push('b-end')
        return 'B'
      },
    })
    s.registerTask({
      id: 'c',
      dependsOn: ['a', 'b'],
      grade: DataGrade.O,
      executor: () => 'C',
    })
    const result = await s.run()
    expect(result.successful).toEqual(['a', 'b', 'c'])
    expect(result.failed.length).toBe(0)
    // a와 b는 병렬 시작
    expect(order.indexOf('a-start')).toBeLessThan(order.indexOf('a-end'))
    expect(order.indexOf('b-start')).toBeLessThan(order.indexOf('a-end'))
  })

  it('FR-R127.5: 부모 결과 자식에 전달', async () => {
    let received: unknown = null
    s.registerTask({
      id: 'parent',
      dependsOn: [],
      grade: DataGrade.O,
      executor: () => ({ data: 42 }),
    })
    s.registerTask({
      id: 'child',
      dependsOn: ['parent'],
      grade: DataGrade.O,
      executor: (ctx) => {
        received = ctx.dependencies.parent
        return 'ok'
      },
    })
    await s.run()
    expect(received).toEqual({ data: 42 })
  })

  it('FR-R127.6: 실패 시 자손 skip', async () => {
    s.registerTask({
      id: 'a',
      dependsOn: [],
      grade: DataGrade.O,
      executor: () => {
        throw new Error('fail')
      },
    })
    s.registerTask({
      id: 'b',
      dependsOn: ['a'],
      grade: DataGrade.O,
      executor: () => 'B',
    })
    s.registerTask({
      id: 'c',
      dependsOn: ['b'],
      grade: DataGrade.O,
      executor: () => 'C',
    })
    const result = await s.run()
    expect(result.failed).toContain('a')
    expect(result.skipped).toContain('b')
    expect(result.skipped).toContain('c')
  })

  it('독립 태스크는 한 태스크 실패와 무관', async () => {
    s.registerTask({
      id: 'a',
      dependsOn: [],
      grade: DataGrade.O,
      executor: () => {
        throw new Error('fail')
      },
    })
    s.registerTask({
      id: 'b',
      dependsOn: [],
      grade: DataGrade.O,
      executor: () => 'B',
    })
    const result = await s.run()
    expect(result.failed).toContain('a')
    expect(result.successful).toContain('b')
  })

  it('abortOnFailure=true 옵션', async () => {
    const sched = new AgentTaskScheduler({ abortOnFailure: true })
    sched.registerTask({
      id: 'a',
      dependsOn: [],
      grade: DataGrade.O,
      executor: () => {
        throw new Error('fail')
      },
    })
    sched.registerTask({
      id: 'b',
      dependsOn: [],
      grade: DataGrade.O,
      executor: () => 'B',
    })
    sched.registerTask({
      id: 'c',
      dependsOn: ['a'],
      grade: DataGrade.O,
      executor: () => 'C',
    })
    sched.registerTask({
      id: 'd',
      dependsOn: ['b'],
      grade: DataGrade.O,
      executor: () => 'D',
    })
    const result = await sched.run()
    expect(result.failed).toContain('a')
    // c는 a 실패로 skip
    expect(result.skipped).toContain('c')
    // d는 abortOnFailure로 실행 안됨 (다음 레벨이므로 skip 처리)
    expect(result.skipped).toContain('d')
  })

  it('FR-R127.7: ScheduleResult 구조', async () => {
    s.registerTask({
      id: 'a',
      dependsOn: [],
      grade: DataGrade.O,
      executor: () => 'A',
    })
    const result = await s.run()
    expect(result.results.length).toBe(1)
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0)
    expect(result.results[0]?.startedAt).toBeLessThanOrEqual(
      result.results[0]?.finishedAt ?? 0,
    )
  })

  it('비동기 executor 처리', async () => {
    s.registerTask({
      id: 'a',
      dependsOn: [],
      grade: DataGrade.O,
      executor: async () => {
        await new Promise((r) => setTimeout(r, 5))
        return 'async-A'
      },
    })
    const result = await s.run()
    expect(result.results[0]?.output).toBe('async-A')
  })

  it('maxConcurrency 1 — 순차 실행', async () => {
    const sched = new AgentTaskScheduler({ maxConcurrency: 1 })
    const order: number[] = []
    for (let i = 0; i < 3; i++) {
      sched.registerTask({
        id: `t${i}`,
        dependsOn: [],
        grade: DataGrade.O,
        executor: async () => {
          order.push(i)
          return i
        },
      })
    }
    await sched.run()
    expect(order).toEqual([0, 1, 2])
  })

  it('maxConcurrency 0 또는 음수 거부', () => {
    expect(() => new AgentTaskScheduler({ maxConcurrency: 0 })).toThrow()
  })

  it('FR-R127.9: 감사 로그', async () => {
    s.registerTask({
      id: 'a',
      dependsOn: [],
      grade: DataGrade.O,
      executor: () => 'A',
    })
    await s.run()
    const log = s.getAuditLog()
    expect(log.some((e) => e.action === 'registerTask')).toBe(true)
    expect(log.some((e) => e.action === 'run')).toBe(true)
    expect(log.some((e) => e.action === 'taskStart')).toBe(true)
    expect(log.some((e) => e.action === 'taskSuccess')).toBe(true)
  })

  it('id 비어있을 시 거부', () => {
    expect(() =>
      s.registerTask({
        id: '',
        dependsOn: [],
        grade: DataGrade.O,
        executor: () => 1,
      }),
    ).toThrow()
  })
})
