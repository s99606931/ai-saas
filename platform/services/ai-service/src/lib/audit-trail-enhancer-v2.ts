// Plan SC: SVC-AI-ADV-R445
// Design Ref: §체크섬 — eventType+maskedActorId+resourceId SHA-256 16자 hex
import { createHash } from 'crypto'

type DataGrade = 'O' | 'C' | 'S'

interface EnhancedAuditEvent {
  eventType: string
  maskedActorId: string
  resourceId: string
  checksum: string
  timestamp: string
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

export class AuditTrailEnhancerV2 {
  private events: EnhancedAuditEvent[] = []
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
  }

  private maskId(id: string): string {
    return createHash('sha256').update(id).digest('hex').substring(0, 16)
  }

  private makeChecksum(eventType: string, maskedActorId: string, resourceId: string): string {
    return createHash('sha256')
      .update(eventType + maskedActorId + resourceId)
      .digest('hex')
      .substring(0, 16)
  }

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  recordEvent(
    eventType: string,
    actorId: string,
    resourceId: string,
    dataGrade?: DataGrade,
  ): EnhancedAuditEvent {
    this.checkGrade(dataGrade)
    const maskedActorId = this.maskId(actorId)
    const checksum = this.makeChecksum(eventType, maskedActorId, resourceId)
    const event: EnhancedAuditEvent = {
      eventType,
      maskedActorId,
      resourceId,
      checksum,
      timestamp: new Date().toISOString(),
    }
    this.events.push(event)
    this.log('audit.record', `eventType=${eventType} resourceId=${resourceId}`)
    return event
  }

  getEventTypeStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    for (const e of this.events) {
      stats[e.eventType] = (stats[e.eventType] ?? 0) + 1
    }
    return stats
  }

  getEventsByType(eventType: string): EnhancedAuditEvent[] {
    return this.events.filter((e) => e.eventType === eventType)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
