/**
 * Agent Task Scheduler (DAG) — SVC-AI-ADV-R127
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R127.design.md
 * Plan SC: FR-R127.1 ~ FR-R127.9
 *
 * DAG 기반 태스크 스케줄러: Kahn 토폴로지 + 병렬 실행 + 결과 전달.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface TaskContext {
  taskId: string
  dependencies: Record<string, unknown>
}

export type TaskExecutor<T = unknown> = (
  ctx: TaskContext,
) => Promise<T> | T

export interface TaskDef<T = unknown> {
  id: string
  dependsOn: string[]
  executor: TaskExecutor<T>
  grade: DataGrade
  skipOnFailure?: boolean
}

export type TaskStatus = 'success' | 'failed' | 'skipped'

export interface TaskResult {
  taskId: string
  status: TaskStatus
  output?: unknown
  error?: string
  startedAt: number
  finishedAt: number
}

export interface ScheduleResult {
  results: TaskResult[]
  successful: string[]
  failed: string[]
  skipped: string[]
  totalDurationMs: number
}

export interface SchedulerAuditEntry {
  timestamp: string
  action:
    | 'registerTask'
    | 'validateDAG'
    | 'run'
    | 'taskStart'
    | 'taskSuccess'
    | 'taskFailed'
    | 'taskSkipped'
    | 'gradeBlocked'
    | 'cycleDetected'
  detail?: Record<string, unknown>
}

export interface SchedulerOptions {
  maxConcurrency?: number
  abortOnFailure?: boolean
}

export class AgentTaskScheduler {
  private readonly tasks: Map<string, TaskDef> = new Map()
  private readonly auditLog: SchedulerAuditEntry[] = []
  private readonly maxConcurrency: number
  private readonly abortOnFailure: boolean

  constructor(options: SchedulerOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 4
    this.abortOnFailure = options.abortOnFailure ?? false
    if (this.maxConcurrency < 1) {
      throw new Error('maxConcurrency must be >= 1')
    }
  }

  getAuditLog(): readonly SchedulerAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: SchedulerAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R127.1 / FR-R127.8: 태스크 등록 + 등급 guard.
   */
  registerTask<T>(task: TaskDef<T>): void {
    if (task.grade === DataGrade.C || task.grade === DataGrade.S) {
      this.audit('gradeBlocked', { taskId: task.id, grade: task.grade })
      throw new Error(
        `BLOCKED: ${task.grade}등급 태스크 등록 금지 (N2SF N-05)`,
      )
    }
    if (!task.id) {
      throw new Error('task id required')
    }
    if (this.tasks.has(task.id)) {
      throw new Error(`Duplicate task id: ${task.id}`)
    }
    this.tasks.set(task.id, {
      id: task.id,
      dependsOn: [...task.dependsOn],
      executor: task.executor as TaskExecutor,
      grade: task.grade,
      skipOnFailure: task.skipOnFailure ?? true,
    })
    this.audit('registerTask', { id: task.id, deps: task.dependsOn.length })
  }

  /**
   * FR-R127.2 / FR-R127.3: Kahn 토폴로지 정렬 + 사이클 검증.
   * 반환: levels[][] (각 레벨의 task id)
   */
  private topologicalLevels(): string[][] {
    const inDegree = new Map<string, number>()
    const downstream = new Map<string, string[]>()

    for (const [id] of this.tasks) {
      inDegree.set(id, 0)
      downstream.set(id, [])
    }

    for (const [id, task] of this.tasks) {
      for (const dep of task.dependsOn) {
        if (!this.tasks.has(dep)) {
          throw new Error(`Task ${id} depends on unknown ${dep}`)
        }
        inDegree.set(id, (inDegree.get(id) ?? 0) + 1)
        downstream.get(dep)?.push(id)
      }
    }

    const levels: string[][] = []
    const remaining = new Set(this.tasks.keys())

    while (remaining.size > 0) {
      const level: string[] = []
      for (const id of remaining) {
        if ((inDegree.get(id) ?? 0) === 0) {
          level.push(id)
        }
      }
      if (level.length === 0) {
        this.audit('cycleDetected', {
          remaining: Array.from(remaining),
        })
        throw new Error('Cycle detected in DAG')
      }
      level.sort() // 결정적
      levels.push(level)
      for (const id of level) {
        remaining.delete(id)
        for (const child of downstream.get(id) ?? []) {
          inDegree.set(child, (inDegree.get(child) ?? 0) - 1)
        }
      }
    }
    return levels
  }

  /**
   * FR-R127.2: 명시적 사이클 검증 (선택).
   */
  validateDAG(): void {
    this.topologicalLevels()
    this.audit('validateDAG', { tasks: this.tasks.size })
  }

  private async runChunk(
    ids: string[],
    results: Map<string, TaskResult>,
    outputs: Map<string, unknown>,
  ): Promise<void> {
    await Promise.all(
      ids.map(async (id) => {
        const task = this.tasks.get(id)
        if (!task) return

        // 부모 실패/skip 검사
        const failedParent = task.dependsOn.find((d) => {
          const r = results.get(d)
          return r?.status === 'failed' || r?.status === 'skipped'
        })
        if (failedParent !== undefined) {
          const skipResult: TaskResult = {
            taskId: id,
            status: 'skipped',
            startedAt: Date.now(),
            finishedAt: Date.now(),
            error: `parent ${failedParent} did not succeed`,
          }
          results.set(id, skipResult)
          this.audit('taskSkipped', { id, reason: failedParent })
          return
        }

        const ctx: TaskContext = {
          taskId: id,
          dependencies: {},
        }
        for (const dep of task.dependsOn) {
          ctx.dependencies[dep] = outputs.get(dep)
        }

        const startedAt = Date.now()
        this.audit('taskStart', { id })
        try {
          const output = await task.executor(ctx)
          const finishedAt = Date.now()
          results.set(id, {
            taskId: id,
            status: 'success',
            output,
            startedAt,
            finishedAt,
          })
          outputs.set(id, output)
          this.audit('taskSuccess', { id, durationMs: finishedAt - startedAt })
        } catch (err) {
          const finishedAt = Date.now()
          const message = err instanceof Error ? err.message : String(err)
          results.set(id, {
            taskId: id,
            status: 'failed',
            error: message,
            startedAt,
            finishedAt,
          })
          this.audit('taskFailed', { id, error: message })
        }
      }),
    )
  }

  /**
   * FR-R127.4 / FR-R127.5 / FR-R127.6 / FR-R127.7: 실행.
   */
  async run(): Promise<ScheduleResult> {
    const startedAt = Date.now()
    this.audit('run', { tasks: this.tasks.size })

    const levels = this.topologicalLevels()
    const results = new Map<string, TaskResult>()
    const outputs = new Map<string, unknown>()
    let aborted = false

    for (const level of levels) {
      if (aborted) {
        // 남은 태스크 모두 skip
        for (const id of level) {
          if (!results.has(id)) {
            results.set(id, {
              taskId: id,
              status: 'skipped',
              startedAt: Date.now(),
              finishedAt: Date.now(),
              error: 'aborted',
            })
            this.audit('taskSkipped', { id, reason: 'aborted' })
          }
        }
        continue
      }
      // chunk by maxConcurrency
      for (let i = 0; i < level.length; i += this.maxConcurrency) {
        const chunk = level.slice(i, i + this.maxConcurrency)
        await this.runChunk(chunk, results, outputs)
      }
      if (this.abortOnFailure) {
        for (const id of level) {
          if (results.get(id)?.status === 'failed') {
            aborted = true
            break
          }
        }
      }
    }

    const finishedAt = Date.now()
    const orderedResults: TaskResult[] = []
    const successful: string[] = []
    const failed: string[] = []
    const skipped: string[] = []
    for (const level of levels) {
      for (const id of level) {
        const r = results.get(id)
        if (!r) continue
        orderedResults.push(r)
        if (r.status === 'success') successful.push(id)
        else if (r.status === 'failed') failed.push(id)
        else skipped.push(id)
      }
    }

    return {
      results: orderedResults,
      successful,
      failed,
      skipped,
      totalDurationMs: finishedAt - startedAt,
    }
  }
}
