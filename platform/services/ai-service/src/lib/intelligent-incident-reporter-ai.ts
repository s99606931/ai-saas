// Design Ref: §R357 — AI기반 지능형 장애 보고서 자동 생성
// Plan SC: SC-R357

export interface IncidentEvent {
  eventId: string
  serviceId: string
  severity: 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4'
  title: string
  detectedAt: string
  resolvedAt?: string
  affectedUsers: number
  rootCause?: string
  timeline: { timestamp: string; description: string }[]
}

export interface IncidentReport {
  incidentId: string
  serviceId: string
  severity: IncidentEvent['severity']
  title: string
  summary: string
  durationMinutes: number | null
  affectedUsers: number
  rootCauseAnalysis: string
  impactAssessment: string
  actionItems: string[]
  preventionRecommendations: string[]
  slaBreached: boolean
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

// SLA 기준 (분)
const SLA_LIMITS: Record<IncidentEvent['severity'], number> = {
  SEV1: 60,
  SEV2: 240,
  SEV3: 1440,
  SEV4: 10080,
}

export class IntelligentIncidentReporterAi {
  private auditLog: AuditEntry[] = []

  generateReport(event: IncidentEvent): IncidentReport {
    const detectedMs = new Date(event.detectedAt).getTime()
    const resolvedMs = event.resolvedAt ? new Date(event.resolvedAt).getTime() : null
    const durationMinutes = resolvedMs ? Math.round((resolvedMs - detectedMs) / 60000) : null

    const slaLimitMinutes = SLA_LIMITS[event.severity]
    const slaBreached = durationMinutes !== null && durationMinutes > slaLimitMinutes

    const rootCauseAnalysis = event.rootCause
      ? `원인 분석: ${event.rootCause}`
      : '원인 분석 진행 중 — 추가 조사 필요'

    const impactAssessment = `영향 사용자 ${event.affectedUsers.toLocaleString()}명` +
      (durationMinutes ? `, 장애 지속 시간 ${durationMinutes}분` : ', 복구 진행 중')

    const actionItems: string[] = []
    if (event.timeline.length > 0) {
      actionItems.push('장애 타임라인 검토 및 감지-대응 시간 분석')
    }
    if (slaBreached) {
      actionItems.push(`SLA 위반 (${slaLimitMinutes}분 초과) — 서비스 수준 계획 재검토`)
    }
    if (!event.rootCause) {
      actionItems.push('근본 원인 분석(RCA) 48시간 내 완료')
    }

    const preventionRecommendations: string[] = []
    if (event.severity === 'SEV1' || event.severity === 'SEV2') {
      preventionRecommendations.push('예측 알림 임계값 강화')
      preventionRecommendations.push('자동 롤백 파이프라인 구성 검토')
    }
    preventionRecommendations.push('포스트모텀 미팅 실시 후 재발 방지 조치 수립')

    const summary = `[${event.severity}] ${event.title} — ${impactAssessment}` +
      (slaBreached ? ' (SLA 위반)' : '')

    this.auditLog.push({ action: 'incident.report', timestamp: new Date().toISOString(), detail: `${event.eventId}:${event.severity}` })
    return {
      incidentId: event.eventId,
      serviceId: event.serviceId,
      severity: event.severity,
      title: event.title,
      summary,
      durationMinutes,
      affectedUsers: event.affectedUsers,
      rootCauseAnalysis,
      impactAssessment,
      actionItems,
      preventionRecommendations,
      slaBreached,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
