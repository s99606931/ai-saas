// Design Ref: §R562 — AI기반 실시간 침입 탐지 v2
// Plan SC: SVC-AI-ADV-R562-SC01

export type ThreatLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ThreatType = 'UNAUTHORIZED_IP' | 'OFF_HOURS_ACCESS' | 'BURST_REQUEST' | 'BRUTE_FORCE' | 'SUSPICIOUS_PATTERN'

export interface AccessBaseline {
  serviceId: string
  allowedIpRanges: string[]   // CIDR 형식 또는 prefix (예: '10.0.', '192.168.')
  businessHoursStart: number  // 0..23 (시)
  businessHoursEnd: number
  maxRequestsPerMinute: number
  maxFailedLoginsPerHour: number
}

export interface AccessEvent {
  eventId: string
  serviceId: string
  sourceIp: string
  timestamp: string   // ISO
  requestsInLastMinute: number
  failedLoginsInLastHour: number
  userId: string | null
  action: string
}

export interface IntrusionAlert {
  alertId: string
  serviceId: string
  eventId: string
  threatType: ThreatType
  threatLevel: ThreatLevel
  sourceIp: string
  detail: string
  recommendedAction: string
  acknowledged: boolean
  detectedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class RealtimeIntrusionDetectorV2 {
  private baselines = new Map<string, AccessBaseline>()
  private alerts: IntrusionAlert[] = []
  private auditLog: AuditEntry[] = []

  registerBaseline(baseline: AccessBaseline): void {
    this.baselines.set(baseline.serviceId, baseline)
    this.appendAudit('baseline.register', baseline.serviceId, { allowedRanges: baseline.allowedIpRanges.length })
  }

  detectIntrusion(event: AccessEvent): IntrusionAlert[] {
    const baseline = this.baselines.get(event.serviceId)
    if (!baseline) return []

    const newAlerts: IntrusionAlert[] = []

    // 단시간 다량 요청 (burst) — 가장 먼저 확인
    if (event.requestsInLastMinute >= baseline.maxRequestsPerMinute) {
      newAlerts.push(this.createAlert(event, 'BURST_REQUEST', 'CRITICAL',
        `단시간 ${event.requestsInLastMinute}건 요청 — 임계값(${baseline.maxRequestsPerMinute}/분) 초과`,
        'WAF 차단 규칙 즉시 적용 및 IP 블랙리스트 등록',
      ))
    }

    // 허용 IP 외 접근
    const isAllowedIp = baseline.allowedIpRanges.some((range) => event.sourceIp.startsWith(range))
    if (!isAllowedIp) {
      newAlerts.push(this.createAlert(event, 'UNAUTHORIZED_IP', 'HIGH',
        `미허가 IP ${event.sourceIp} 접근 시도`,
        '해당 IP 즉시 차단 및 보안 담당자 통보',
      ))
    }

    // 비업무 시간 접근
    const hour = new Date(event.timestamp).getUTCHours()
    const isBusinessHours = hour >= baseline.businessHoursStart && hour < baseline.businessHoursEnd
    if (!isBusinessHours) {
      newAlerts.push(this.createAlert(event, 'OFF_HOURS_ACCESS', 'MEDIUM',
        `비업무 시간(${hour}시) 접근 — 업무 시간: ${baseline.businessHoursStart}~${baseline.businessHoursEnd}시`,
        '해당 접근에 대한 업무 목적 확인 요청',
      ))
    }

    // 무차별 로그인 시도
    if (event.failedLoginsInLastHour >= baseline.maxFailedLoginsPerHour) {
      newAlerts.push(this.createAlert(event, 'BRUTE_FORCE', 'HIGH',
        `1시간 내 로그인 실패 ${event.failedLoginsInLastHour}건 — 임계값(${baseline.maxFailedLoginsPerHour}) 초과`,
        '해당 계정 일시 잠금 및 비밀번호 재설정 강제',
      ))
    }

    this.alerts.push(...newAlerts)
    this.appendAudit('intrusion.detect', event.serviceId, { eventId: event.eventId, newAlerts: newAlerts.length })
    return newAlerts
  }

  getAlerts(serviceId?: string): IntrusionAlert[] {
    const filtered = serviceId ? this.alerts.filter((a) => a.serviceId === serviceId) : this.alerts
    return filtered.filter((a) => !a.acknowledged)
  }

  acknowledge(alertId: string): void {
    const alert = this.alerts.find((a) => a.alertId === alertId)
    if (!alert) throw new Error(`Unknown alert: ${alertId}`)
    alert.acknowledged = true
    this.appendAudit('alert.acknowledge', alert.serviceId, { alertId, threatType: alert.threatType })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private createAlert(
    event: AccessEvent,
    threatType: ThreatType,
    threatLevel: ThreatLevel,
    detail: string,
    recommendedAction: string,
  ): IntrusionAlert {
    return {
      alertId: `ALT-${event.eventId}-${threatType}`,
      serviceId: event.serviceId,
      eventId: event.eventId,
      threatType,
      threatLevel,
      sourceIp: event.sourceIp,
      detail,
      recommendedAction,
      acknowledged: false,
      detectedAt: new Date().toISOString(),
    }
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
