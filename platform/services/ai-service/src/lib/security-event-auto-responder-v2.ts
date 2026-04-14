// Design Ref: §설계결정 — AI기반 자동 보안 이벤트 대응 v2
// Plan SC: FR-R575.1~5

interface EventType { typeId: string; name: string; severity: 'low' | 'medium' | 'high' | 'critical' }
interface SecurityEvent { eventId: string; typeId: string; source: string; responded: boolean; timestamp: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const RESPONSE_ACTIONS: Record<string, string> = {
  low: '모니터링 강화',
  medium: '담당자 알림',
  high: '즉시 격리',
  critical: '긴급 대응 팀 소집',
}

export class SecurityEventAutoResponderV2 {
  private eventTypes = new Map<string, EventType>()
  private events = new Map<string, SecurityEvent>()
  private auditLog: AuditEntry[] = []

  registerEventType(typeId: string, name: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    this.eventTypes.set(typeId, { typeId, name, severity })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_EVENT_TYPE', details: { typeId, name, severity } })
  }

  recordEvent(eventId: string, typeId: string, source: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.events.set(eventId, { eventId, typeId, source, responded: false, timestamp: new Date().toISOString() })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_EVENT', details: { eventId, typeId, source } })
  }

  getResponseAction(eventId: string): string {
    const event = this.events.get(eventId)
    if (!event) return '알 수 없는 이벤트'
    const eventType = this.eventTypes.get(event.typeId)
    if (!eventType) return '유형 미등록'
    this.events.set(eventId, { ...event, responded: true })
    return RESPONSE_ACTIONS[eventType.severity] ?? '검토 필요'
  }

  getUnrespondedHighRiskEvents(): SecurityEvent[] {
    return Array.from(this.events.values()).filter(e => {
      if (e.responded) return false
      const et = this.eventTypes.get(e.typeId)
      return et?.severity === 'high' || et?.severity === 'critical'
    })
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
