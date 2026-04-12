/**
 * Citizen Journey Orchestrator — SVC-AI-ADV-R141
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R141.design.md
 * Plan SC: FR-R141.1 ~ FR-R141.6
 *
 * 민원인 여정(접수→심사→처리→통보) 전체 오케스트레이션.
 * 민원사무처리법·행안부 민원처리기준 SLA 준수.
 * 민원인 식별자는 해시 형태로만 수신. N2SF O등급 강제.
 */

export type DataGrade = 'O' | 'C' | 'S'
export type StageOutcome = 'success' | 'failure'
export type JourneyStatus = 'active' | 'completed' | 'delayed'

export interface JourneyStage {
  id: string
  slaMinutes: number
  nextOnSuccess?: string
  nextOnFailure?: string
  terminal?: boolean
}

export interface StageVisit {
  stageId: string
  enteredAt: number
  leftAt?: number
  outcome?: StageOutcome
}

export interface JourneyInstance {
  citizenHash: string
  currentStageId: string
  enteredAt: number
  status: JourneyStatus
  history: StageVisit[]
}

export interface SlaViolation {
  citizenHash: string
  stageId: string
  overdueByMinutes: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface OrchestratorOptions {
  now?: () => number
}

export class CitizenJourneyOrchestrator {
  private readonly stages = new Map<string, JourneyStage>()
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number

  constructor(opts: OrchestratorOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /**
   * 단계 정의 등록.
   * FR-R141.1
   */
  defineStage(stage: JourneyStage): void {
    if (!stage.id) {
      throw new Error('INVALID_STAGE: id required')
    }
    if (stage.slaMinutes <= 0) {
      throw new Error('INVALID_STAGE: slaMinutes must be > 0')
    }
    this.stages.set(stage.id, stage)
  }

  /**
   * 여정 인스턴스 생성.
   * FR-R141.2
   */
  startJourney(
    citizenHash: string,
    initialStageId: string,
    grade: DataGrade = 'O',
  ): JourneyInstance {
    this.assertDataGrade(grade)
    if (!this.stages.has(initialStageId)) {
      throw new Error(`UNKNOWN_STAGE: ${initialStageId}`)
    }
    if (!/^[a-f0-9]{8,}$/i.test(citizenHash)) {
      throw new Error('INVALID_HASH: citizenHash must be hex-encoded (min 8 chars)')
    }

    const now = this.now()
    const instance: JourneyInstance = {
      citizenHash,
      currentStageId: initialStageId,
      enteredAt: now,
      status: 'active',
      history: [{ stageId: initialStageId, enteredAt: now }],
    }

    this.auditLog.push({
      event: 'journey.started',
      detail: { citizenHash, stage: initialStageId },
      at: now,
    })

    return instance
  }

  /**
   * 다음 단계 전이.
   * FR-R141.4
   */
  advance(
    instance: JourneyInstance,
    outcome: StageOutcome,
    grade: DataGrade = 'O',
  ): JourneyInstance {
    this.assertDataGrade(grade)
    const currentStage = this.stages.get(instance.currentStageId)
    if (!currentStage) {
      throw new Error(`UNKNOWN_STAGE: ${instance.currentStageId}`)
    }

    const now = this.now()
    const updatedHistory = [...instance.history]
    const lastVisit = updatedHistory[updatedHistory.length - 1]
    if (lastVisit && lastVisit.stageId === instance.currentStageId && !lastVisit.leftAt) {
      lastVisit.leftAt = now
      lastVisit.outcome = outcome
    }

    const nextId =
      outcome === 'success' ? currentStage.nextOnSuccess : currentStage.nextOnFailure

    let status: JourneyStatus = 'active'
    let nextStageId = instance.currentStageId

    if (!nextId || currentStage.terminal) {
      status = 'completed'
    } else {
      if (!this.stages.has(nextId)) {
        throw new Error(`UNKNOWN_STAGE: ${nextId}`)
      }
      nextStageId = nextId
      updatedHistory.push({ stageId: nextId, enteredAt: now })
    }

    const updated: JourneyInstance = {
      ...instance,
      currentStageId: nextStageId,
      history: updatedHistory,
      enteredAt: now,
      status,
    }

    this.auditLog.push({
      event: 'journey.advanced',
      detail: { citizenHash: instance.citizenHash, from: currentStage.id, to: nextStageId, outcome },
      at: now,
    })

    return updated
  }

  /**
   * SLA 위반 식별.
   * FR-R141.3
   */
  checkSlaViolations(
    instances: JourneyInstance[],
    nowMs?: number,
  ): SlaViolation[] {
    const now = nowMs ?? this.now()
    const violations: SlaViolation[] = []

    for (const inst of instances) {
      if (inst.status !== 'active') {
        continue
      }
      const stage = this.stages.get(inst.currentStageId)
      if (!stage) {
        continue
      }
      const elapsedMinutes = (now - inst.enteredAt) / 60000
      if (elapsedMinutes > stage.slaMinutes) {
        violations.push({
          citizenHash: inst.citizenHash,
          stageId: stage.id,
          overdueByMinutes: elapsedMinutes - stage.slaMinutes,
        })
      }
    }

    if (violations.length > 0) {
      this.auditLog.push({
        event: 'journey.sla.violations',
        detail: { count: violations.length },
        at: this.now(),
      })
    }

    return violations
  }

  /**
   * 감사 로그.
   * FR-R141.5
   */
  getAuditLog(): ReadonlyArray<AuditEntry> {
    return [...this.auditLog]
  }

  private assertDataGrade(grade: DataGrade): void {
    if (grade !== 'O') {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 Citizen Journey Orchestrator 전송 금지 (N2SF N-05)`,
      )
    }
  }
}
