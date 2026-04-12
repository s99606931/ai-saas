// SVC-AI-ADV-R65: 위기 대응 엔진 (시그널 → 플레이북 매칭 → 실행)
// Design Ref: §시그널 매칭, §실행 흐름
// Plan SC: FR-R65.1, FR-R65.3

import {
  type Playbook,
  type PlaybookSeverity,
  type PlaybookStep,
  type StepExecutionResult,
  type ExecutionContext,
  type StepExecutor,
  PlaybookExecutor,
  buildDefaultPlaybooks,
} from './incident-playbook'
import { randomUUID } from 'crypto'

export interface IncidentSignal {
  id: string
  type: string
  severity: PlaybookSeverity
  source: string
  tags: string[]
  metrics: Record<string, number>
  payload: Record<string, unknown>
  receivedAt: Date
}

export interface Actor {
  id: string
  role: string
}

export interface PlaybookMatch {
  playbook: Playbook
  score: number
  reasons: string[]
}

export interface RunRecord {
  runId: string
  playbookId: string
  signal: IncidentSignal
  actor: Actor
  startedAt: Date
  completedAt?: Date
  results: StepExecutionResult[]
  status: 'running' | 'completed' | 'failed' | 'pending-approval'
}

export interface CrisisEngineOptions {
  playbooks?: Playbook[]
  executor?: PlaybookExecutor
  stepExecutor: StepExecutor
  auditSink?: (event: Record<string, unknown>) => Promise<void> | void
}

/**
 * 위기 대응 엔진.
 * 시그널을 받아 최적 플레이북을 선택하고 실행을 오케스트레이션한다.
 */
export class CrisisResponseEngine {
  private readonly playbooks: Playbook[]
  private readonly executor: PlaybookExecutor
  private readonly stepExecutor: StepExecutor
  private readonly auditSink?: CrisisEngineOptions['auditSink']
  private readonly runs: Map<string, RunRecord> = new Map()

  private static readonly SEVERITY_ORDER: Record<PlaybookSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }

  constructor(options: CrisisEngineOptions) {
    this.playbooks = options.playbooks ?? buildDefaultPlaybooks()
    this.executor = options.executor ?? new PlaybookExecutor()
    this.stepExecutor = options.stepExecutor
    this.auditSink = options.auditSink
  }

  /**
   * 시그널 → 최적 플레이북 선택.
   */
  match(signal: IncidentSignal): PlaybookMatch | null {
    const matches: PlaybookMatch[] = []
    const signalSeverity = CrisisResponseEngine.SEVERITY_ORDER[signal.severity]

    for (const pb of this.playbooks) {
      const reasons: string[] = []
      let score = 0

      for (const trigger of pb.triggers) {
        if (trigger.signalType !== signal.type) continue
        score += 10
        reasons.push(`type match: ${trigger.signalType}`)

        if (trigger.minSeverity) {
          const minOrd = CrisisResponseEngine.SEVERITY_ORDER[trigger.minSeverity]
          if (signalSeverity >= minOrd) {
            score += 5
            reasons.push(`severity ≥ ${trigger.minSeverity}`)
          } else {
            score -= 20
          }
        }

        if (trigger.requiredTags && trigger.requiredTags.length > 0) {
          const matchedTags = trigger.requiredTags.filter((t) => signal.tags.includes(t))
          score += matchedTags.length * 2
          if (matchedTags.length > 0) {
            reasons.push(`tags: ${matchedTags.join(', ')}`)
          }
        }
      }

      if (score > 0) {
        matches.push({ playbook: pb, score, reasons })
      }
    }

    if (matches.length === 0) return null
    matches.sort((a, b) => b.score - a.score)
    return matches[0] ?? null
  }

  /**
   * 시그널 대응 실행 엔트리 포인트.
   */
  async respond(signal: IncidentSignal, actor: Actor): Promise<RunRecord> {
    if (!signal || !actor) {
      throw new Error('signal and actor required')
    }

    const match = this.match(signal)
    if (!match) {
      throw new Error(`no matching playbook for signal type=${signal.type}`)
    }

    // RBAC 검증
    if (actor.role !== match.playbook.requiredRole && actor.role !== 'admin') {
      await this.audit({
        action: 'PLAYBOOK_DENIED',
        signal: signal.id,
        playbook: match.playbook.id,
        actorId: actor.id,
        actorRole: actor.role,
        requiredRole: match.playbook.requiredRole,
      })
      throw new Error(
        `BLOCKED: actor role '${actor.role}' cannot execute playbook '${match.playbook.id}' (requires '${match.playbook.requiredRole}')`,
      )
    }

    const runId = randomUUID()
    const record: RunRecord = {
      runId,
      playbookId: match.playbook.id,
      signal,
      actor,
      startedAt: new Date(),
      results: [],
      status: 'running',
    }
    this.runs.set(runId, record)

    await this.audit({
      action: 'PLAYBOOK_START',
      runId,
      playbookId: match.playbook.id,
      signalId: signal.id,
      signalType: signal.type,
      severity: signal.severity,
      actorId: actor.id,
    })

    const context: ExecutionContext = {
      playbookId: match.playbook.id,
      runId,
      actorId: actor.id,
      actorRole: actor.role,
      signalPayload: signal.payload,
      previousResults: [],
    }

    // 감사 로깅 래퍼로 stepExecutor 래핑
    const wrappedExecutor: StepExecutor = async (step, ctx) => {
      await this.audit({
        action: 'PLAYBOOK_STEP_START',
        runId,
        stepId: step.id,
        stepAction: step.action,
      })
      const output = await this.stepExecutor(step, ctx)
      await this.audit({
        action: 'PLAYBOOK_STEP_DONE',
        runId,
        stepId: step.id,
      })
      return output
    }

    try {
      record.results = await this.executor.execute(match.playbook, context, wrappedExecutor)
    } catch (error) {
      record.status = 'failed'
      const message = error instanceof Error ? error.message : String(error)
      await this.audit({ action: 'PLAYBOOK_ERROR', runId, error: message })
    }

    record.completedAt = new Date()
    if (record.status === 'running') {
      const hasPending = record.results.some((r) => r.status === 'pending-approval')
      const hasFailure = record.results.some((r) => r.status === 'failure' || r.status === 'timeout')
      if (hasPending) record.status = 'pending-approval'
      else if (hasFailure) record.status = 'failed'
      else record.status = 'completed'
    }

    await this.audit({
      action: 'PLAYBOOK_END',
      runId,
      status: record.status,
      stepCount: record.results.length,
    })

    return record
  }

  /**
   * 실행 이력 조회.
   */
  getRun(runId: string): RunRecord | undefined {
    return this.runs.get(runId)
  }

  /**
   * 전체 이력 조회.
   */
  listRuns(): RunRecord[] {
    return Array.from(this.runs.values())
  }

  /**
   * 등록된 플레이북 목록.
   */
  listPlaybooks(): Playbook[] {
    return this.playbooks.slice()
  }

  private async audit(event: Record<string, unknown>): Promise<void> {
    if (!this.auditSink) return
    await this.auditSink({
      ts: new Date().toISOString(),
      source: 'crisis-response-engine',
      ...event,
    })
  }
}

export function createCrisisResponseEngine(options: CrisisEngineOptions): CrisisResponseEngine {
  return new CrisisResponseEngine(options)
}

export type { PlaybookStep, StepExecutionResult }
