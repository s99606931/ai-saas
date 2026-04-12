/**
 * AI Incident Response Playbook — SVC-AI-ADV-R104
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R104.design.md
 * Plan SC: FR-R104.1 ~ FR-R104.5
 *
 * AI 시스템 장애 유형별 자동 대응 플레이북 실행 엔진.
 * CSAP D-06 침해사고 관리.
 */

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

export type IncidentStatus =
  | 'detected'
  | 'in_progress'
  | 'resolved'
  | 'failed'

export interface PlaybookStep {
  id: string
  description: string
  action: string
  expectedOutcome?: string
}

export interface Playbook {
  incidentType: string
  defaultSeverity: IncidentSeverity
  steps: PlaybookStep[]
}

export interface IncidentSignal {
  incidentId: string
  summary: string
  severityHint?: IncidentSeverity
  context?: Record<string, unknown>
}

export interface StepResult {
  stepId: string
  success: boolean
  output: string
  at: string
}

export interface Incident {
  incidentId: string
  incidentType: string
  severity: IncidentSeverity
  status: IncidentStatus
  stepResults: StepResult[]
  startedAt: string
  completedAt?: string
}

export type StepExecutor = (
  action: string,
  context: Record<string, unknown>,
) => Promise<{ success: boolean; output: string }>

export interface PlaybookAuditEntry {
  timestamp: string
  action:
    | 'registerPlaybook'
    | 'triage'
    | 'executePlaybook'
    | 'stepExecuted'
    | 'incidentResolved'
    | 'incidentFailed'
  detail?: Record<string, unknown>
}

const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

const KEYWORD_MAP: Array<{ keyword: string; type: string }> = [
  { keyword: 'hallucination', type: 'ai.hallucination' },
  { keyword: '환각', type: 'ai.hallucination' },
  { keyword: 'timeout', type: 'ai.timeout' },
  { keyword: '지연', type: 'ai.timeout' },
  { keyword: 'bias', type: 'ai.bias' },
  { keyword: '편향', type: 'ai.bias' },
  { keyword: 'poisoning', type: 'ai.data-poisoning' },
  { keyword: 'leak', type: 'ai.data-leak' },
  { keyword: '유출', type: 'ai.data-leak' },
]

export class AiIncidentResponsePlaybook {
  private readonly playbooks = new Map<string, Playbook>()
  private readonly incidents = new Map<string, Incident>()
  private readonly auditLog: PlaybookAuditEntry[] = []

  /**
   * CSAP D-06: 감사 로그 조회.
   */
  getAuditLog(): readonly PlaybookAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: PlaybookAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R104.1: 장애 유형별 플레이북 등록.
   */
  registerPlaybook(playbook: Playbook): void {
    if (playbook.steps.length === 0) {
      throw new Error(`playbook must have at least one step`)
    }
    this.playbooks.set(playbook.incidentType, playbook)
    this.audit('registerPlaybook', {
      incidentType: playbook.incidentType,
      steps: playbook.steps.length,
    })
  }

  /**
   * FR-R104.2: 신호 → 플레이북 매칭 + severity 판정.
   */
  triage(signal: IncidentSignal): {
    incidentType: string | null
    severity: IncidentSeverity
  } {
    const lower = signal.summary.toLowerCase()
    let matched: string | null = null
    for (const { keyword, type } of KEYWORD_MAP) {
      if (lower.includes(keyword.toLowerCase())) {
        matched = type
        break
      }
    }
    let severity: IncidentSeverity = signal.severityHint ?? 'medium'
    if (matched) {
      const pb = this.playbooks.get(matched)
      if (pb) {
        const hintRank = SEVERITY_RANK[severity]
        const defaultRank = SEVERITY_RANK[pb.defaultSeverity]
        severity = hintRank >= defaultRank ? severity : pb.defaultSeverity
      }
    }
    this.audit('triage', {
      incidentId: signal.incidentId,
      matched,
      severity,
    })
    return { incidentType: matched, severity }
  }

  /**
   * FR-R104.3: 플레이북 단계 순차 실행.
   */
  async executePlaybook(
    incidentId: string,
    incidentType: string,
    executor: StepExecutor,
    context: Record<string, unknown> = {},
  ): Promise<Incident> {
    const playbook = this.playbooks.get(incidentType)
    if (!playbook) throw new Error(`no playbook for type: ${incidentType}`)

    const incident: Incident = {
      incidentId,
      incidentType,
      severity: playbook.defaultSeverity,
      status: 'in_progress',
      stepResults: [],
      startedAt: new Date().toISOString(),
    }
    this.incidents.set(incidentId, incident)
    this.audit('executePlaybook', {
      incidentId,
      incidentType,
      totalSteps: playbook.steps.length,
    })

    for (const step of playbook.steps) {
      const result = await executor(step.action, {
        ...context,
        incidentId,
        stepId: step.id,
      })
      const stepResult: StepResult = {
        stepId: step.id,
        success: result.success,
        output: result.output,
        at: new Date().toISOString(),
      }
      incident.stepResults.push(stepResult)
      this.audit('stepExecuted', {
        incidentId,
        stepId: step.id,
        success: result.success,
      })
      if (!result.success) {
        incident.status = 'failed'
        incident.completedAt = new Date().toISOString()
        this.audit('incidentFailed', { incidentId, failedStep: step.id })
        return incident
      }
    }

    incident.status = 'resolved'
    incident.completedAt = new Date().toISOString()
    this.audit('incidentResolved', { incidentId })
    return incident
  }

  /**
   * FR-R104.4: 인시던트 상태 조회.
   */
  getIncidentStatus(incidentId: string): Incident | null {
    return this.incidents.get(incidentId) ?? null
  }

  /**
   * FR-R104.5: 진행 중 인시던트 목록.
   */
  listActiveIncidents(): Incident[] {
    return Array.from(this.incidents.values()).filter(
      (i) => i.status === 'detected' || i.status === 'in_progress',
    )
  }
}
