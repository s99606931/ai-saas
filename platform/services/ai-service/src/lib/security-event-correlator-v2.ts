// Design Ref: §R270 — 보안 이벤트 상관분석 v2
// Plan SC: SVC-AI-ADV-R270-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type ThreatLevel = 'LOW' | 'MED' | 'HIGH' | 'CRITICAL'
export type EventType = 'LOGIN_FAIL' | 'PORT_SCAN' | 'PRIV_ESC' | 'FILE_ACCESS' | 'UNKNOWN'

export interface SecurityEvent {
  eventId: string
  timestamp: string
  sourceIp: string
  eventType: EventType
  detail?: string
}

export interface CorrelationGroup {
  sourceIpMasked: string
  startTime: string
  endTime: string
  eventCount: number
  eventTypes: EventType[]
  pattern: string
  threatLevel: ThreatLevel
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

export class SecurityEventCorrelatorV2 {
  private events: SecurityEvent[] = []
  private auditLog: AuditEntry[] = []
  private readonly maxEvents = 10000

  ingestEvent(ev: SecurityEvent, grade: DataGrade, caller: string): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 이벤트 수집 금지 (N2SF N-05)`)
    }
    if (!ev.eventId) throw new Error('eventId 필수')
    if (!this.isValidIp(ev.sourceIp)) {
      throw new Error(`유효하지 않은 sourceIp: ${ev.sourceIp}`)
    }
    this.events.push({ ...ev })
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents)
    }
    this.appendAudit('event.ingest', this.mask(caller), {
      eventId: ev.eventId,
      sourceIpMasked: this.maskIp(ev.sourceIp),
      eventType: ev.eventType,
    })
  }

  correlate(windowMs = 300000): CorrelationGroup[] {
    const byIp = new Map<string, SecurityEvent[]>()
    for (const e of this.events) {
      const list = byIp.get(e.sourceIp) ?? []
      list.push(e)
      byIp.set(e.sourceIp, list)
    }

    const groups: CorrelationGroup[] = []
    for (const [ip, events] of byIp.entries()) {
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      // 슬라이딩 윈도우 그룹화
      let i = 0
      while (i < events.length) {
        const startEv = events[i]
        if (!startEv) break
        const windowEnd = new Date(startEv.timestamp).getTime() + windowMs
        const group: SecurityEvent[] = [startEv]
        let j = i + 1
        while (j < events.length) {
          const nextEv = events[j]
          if (!nextEv) break
          if (new Date(nextEv.timestamp).getTime() > windowEnd) break
          group.push(nextEv)
          j++
        }
        if (group.length >= 2) {
          const first = group[0]
          const last = group[group.length - 1]
          if (first && last) {
            groups.push(this.classifyGroup(ip, first.timestamp, last.timestamp, group))
          }
        }
        i = j > i ? j : i + 1
      }
    }

    this.appendAudit('correlate', 'SYSTEM', {
      groupCount: groups.length,
      windowMs,
    })
    return groups
  }

  getEventCount(): number {
    return this.events.length
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private classifyGroup(
    ip: string,
    startTime: string,
    endTime: string,
    events: SecurityEvent[]
  ): CorrelationGroup {
    const types = events.map((e) => e.eventType)
    const loginFails = types.filter((t) => t === 'LOGIN_FAIL').length
    const portScans = types.filter((t) => t === 'PORT_SCAN').length
    const privEsc = types.filter((t) => t === 'PRIV_ESC').length
    const uniqueTypes = [...new Set(types)]

    let pattern = 'GENERIC'
    let level: ThreatLevel = 'LOW'

    if (privEsc >= 1) {
      pattern = 'PRIVILEGE_ESCALATION'
      level = 'CRITICAL'
    } else if (loginFails >= 5) {
      pattern = 'BRUTE_FORCE'
      level = 'HIGH'
    } else if (portScans >= 3) {
      pattern = 'PORT_SCANNING'
      level = 'MED'
    } else if (uniqueTypes.length >= 3) {
      pattern = 'MIXED_ATTACK'
      level = 'HIGH'
    } else if (loginFails >= 2) {
      pattern = 'SUSPICIOUS_LOGIN'
      level = 'MED'
    }

    return {
      sourceIpMasked: this.maskIp(ip),
      startTime,
      endTime,
      eventCount: events.length,
      eventTypes: uniqueTypes,
      pattern,
      threatLevel: level,
    }
  }

  private isValidIp(ip: string): boolean {
    const parts = ip.split('.')
    if (parts.length !== 4) return false
    for (const p of parts) {
      const n = Number(p)
      if (!Number.isInteger(n) || n < 0 || n > 255) return false
    }
    return true
  }

  private maskIp(ip: string): string {
    const parts = ip.split('.')
    if (parts.length !== 4) return '***'
    return `${parts[0]}.${parts[1]}.${parts[2]}.***`
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(
    action: string,
    callerMasked: string,
    detail: Record<string, unknown>
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
