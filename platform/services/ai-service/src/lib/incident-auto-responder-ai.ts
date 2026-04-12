// Design Ref: §R213 — AI기반 서비스 장애 자동 대응
// Plan SC: SVC-AI-ADV-R213-SC01

export type IncidentSeverity = 'P1' | 'P2' | 'P3' | 'P4'
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'MITIGATING' | 'RESOLVED'

export interface Incident {
  incidentId: string
  title: string
  description: string
  affectedService: string
  severity: IncidentSeverity
  detectedAt: string
}

export interface ResponseAction {
  actionId: string
  type: 'PAGE_ONCALL' | 'SCALE_OUT' | 'RESTART_SERVICE' | 'ENABLE_CIRCUIT_BREAKER' | 'NOTIFY_STAKEHOLDERS' | 'ROLLBACK'
  description: string
  automated: boolean
  executedAt?: string
}

export interface IncidentResponse {
  incidentId: string
  status: IncidentStatus
  assignedTo: string
  actions: ResponseAction[]
  estimatedResolutionMin: number
  runbookUrl: string
}

interface AuditEntry {
  timestamp: string
  action: string
  incidentId: string
  detail: Record<string, unknown>
}

export class IncidentAutoResponderAI {
  private incidents = new Map<string, Incident>()
  private responses = new Map<string, IncidentResponse>()
  private auditLog: AuditEntry[] = []

  registerIncident(incident: Incident): IncidentResponse {
    this.incidents.set(incident.incidentId, incident)
    this.appendAudit('incident.register', incident.incidentId, { severity: incident.severity })

    const response = this.buildResponse(incident)
    this.responses.set(incident.incidentId, response)
    this.appendAudit('incident.respond', incident.incidentId, { status: response.status, actionCount: response.actions.length })

    return { ...response, actions: [...response.actions] }
  }

  updateStatus(incidentId: string, status: IncidentStatus): void {
    const response = this.responses.get(incidentId)
    if (!response) throw new Error(`Unknown incident: ${incidentId}`)
    response.status = status
    this.appendAudit('incident.statusUpdate', incidentId, { status })
  }

  getResponse(incidentId: string): IncidentResponse {
    const response = this.responses.get(incidentId)
    if (!response) throw new Error(`Unknown incident: ${incidentId}`)
    return { ...response, actions: [...response.actions] }
  }

  private buildResponse(incident: Incident): IncidentResponse {
    const actions: ResponseAction[] = []
    let stepId = 1

    // P1/P2: 온콜 호출
    if (incident.severity === 'P1' || incident.severity === 'P2') {
      actions.push({
        actionId: `A-${stepId++}`,
        type: 'PAGE_ONCALL',
        description: `${incident.severity} 인시던트 — 온콜 엔지니어 즉시 호출`,
        automated: true,
        executedAt: new Date().toISOString(),
      })
    }

    // 스케일 아웃 (P1~P3)
    if (incident.severity !== 'P4') {
      actions.push({
        actionId: `A-${stepId++}`,
        type: 'SCALE_OUT',
        description: `${incident.affectedService} 인스턴스 자동 확장`,
        automated: true,
        executedAt: new Date().toISOString(),
      })
    }

    // 회로 차단기 활성화
    actions.push({
      actionId: `A-${stepId++}`,
      type: 'ENABLE_CIRCUIT_BREAKER',
      description: `${incident.affectedService} 회로 차단기 활성화`,
      automated: true,
      executedAt: new Date().toISOString(),
    })

    // 이해관계자 알림
    actions.push({
      actionId: `A-${stepId++}`,
      type: 'NOTIFY_STAKEHOLDERS',
      description: '인시던트 상황 이해관계자 알림 발송',
      automated: true,
      executedAt: new Date().toISOString(),
    })

    const severityResolutionMin: Record<IncidentSeverity, number> = { P1: 30, P2: 60, P3: 240, P4: 480 }
    const assignedTo = incident.severity === 'P1' ? 'ONCALL_PRIMARY' : 'ONCALL_SECONDARY'

    return {
      incidentId: incident.incidentId,
      status: 'INVESTIGATING',
      assignedTo,
      actions,
      estimatedResolutionMin: severityResolutionMin[incident.severity],
      runbookUrl: `/runbooks/${incident.affectedService}`,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, incidentId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, incidentId, detail })
  }
}
