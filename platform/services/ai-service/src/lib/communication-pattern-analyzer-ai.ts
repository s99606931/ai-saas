// Plan SC: SVC-AI-ADV-R440
// Design Ref: §PII마스킹 — SHA-256 16자 hex로 participantId 보호
import { createHash } from 'crypto'

type DataGrade = 'O' | 'C' | 'S'

interface CommEvent {
  eventId: string
  channel: string
  maskedParticipantId: string
  durationMs: number
  timestamp: string
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

interface ChannelStat {
  channel: string
  avgDurationMs: number
  eventCount: number
}

export class CommunicationPatternAnalyzerAI {
  private events: CommEvent[] = []
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
  }

  private maskId(id: string): string {
    return createHash('sha256').update(id).digest('hex').substring(0, 16)
  }

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  addEvent(
    eventId: string,
    channel: string,
    participantId: string,
    durationMs: number,
    dataGrade?: DataGrade,
  ): CommEvent {
    this.checkGrade(dataGrade)
    const event: CommEvent = {
      eventId,
      channel,
      maskedParticipantId: this.maskId(participantId),
      durationMs,
      timestamp: new Date().toISOString(),
    }
    this.events.push(event)
    this.log('event.add', `eventId=${eventId} channel=${channel}`)
    return event
  }

  getChannelStats(channel: string): ChannelStat {
    const channelEvents = this.events.filter((e) => e.channel === channel)
    if (channelEvents.length === 0) return { channel, avgDurationMs: 0, eventCount: 0 }
    const avg = channelEvents.reduce((s, e) => s + e.durationMs, 0) / channelEvents.length
    return { channel, avgDurationMs: avg, eventCount: channelEvents.length }
  }

  getInefficientChannels(thresholdMs: number): ChannelStat[] {
    const channels = [...new Set(this.events.map((e) => e.channel))]
    return channels
      .map((ch) => this.getChannelStats(ch))
      .filter((s) => s.avgDurationMs > thresholdMs)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
