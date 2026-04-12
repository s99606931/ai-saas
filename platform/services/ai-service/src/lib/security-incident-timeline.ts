/**
 * Security Incident Timeline AI — SVC-AI-ADV-R151 (트랙 B 3차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R146-R153-trackB/SVC-AI-ADV-R151.design.md
 * Plan SC: FR-R151.1 ~ FR-R151.5
 *
 * 보안 이벤트 수집 → 타임라인 구성 → MITRE ATT&CK 매핑 → 공격 체인 분석.
 * CSAP D-06: append-only 이벤트 저장.
 */

// Design Ref: §2 — 타입 정의

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface SecurityEvent {
  eventId: string
  timestamp: number
  actor: string
  action: string
  resource: string
  traceId?: string
  incidentId?: string
  severity: Severity
}

export interface TimelineFilter {
  from?: number
  to?: number
  actor?: string
  action?: string
  incidentId?: string
}

export interface AttackChain {
  traceId: string
  events: SecurityEvent[]
  mitreMapping: string[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

// Design Ref: §3.3 MITRE ATT&CK 매핑
const MITRE_MAP: Record<string, string> = {
  login_fail: 'T1110 (Brute Force)',
  privilege_escalation: 'T1068 (Exploitation for Privilege Escalation)',
  data_exfil: 'T1041 (Exfiltration Over C2 Channel)',
  lateral_movement: 'T1021 (Remote Services)',
  persistence: 'T1053 (Scheduled Task)',
}

export class SecurityIncidentTimeline {
  private readonly events: SecurityEvent[] = []  // append-only
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R151.1 — CSAP D-06 append-only
  ingestEvent(event: SecurityEvent): void {
    this.events.push({ ...event })
    this.appendAudit('event.ingest', { eventId: event.eventId, severity: event.severity })
  }

  // Plan SC: FR-R151.2 — Design Ref: §3.1 타임라인 필터 + 정렬
  buildTimeline(filter?: TimelineFilter): SecurityEvent[] {
    let result = [...this.events]

    if (filter) {
      if (filter.from !== undefined) result = result.filter((e) => e.timestamp >= filter.from!)
      if (filter.to !== undefined) result = result.filter((e) => e.timestamp <= filter.to!)
      if (filter.actor) result = result.filter((e) => e.actor === filter.actor)
      if (filter.action) result = result.filter((e) => e.action === filter.action)
      if (filter.incidentId) result = result.filter((e) => e.incidentId === filter.incidentId)
    }

    result.sort((a, b) => a.timestamp - b.timestamp)
    this.appendAudit('timeline.build', { filterApplied: !!filter, count: result.length })
    return result
  }

  // Plan SC: FR-R151.3 — Design Ref: §3.2 공격 체인 (traceId union incidentId)
  buildAttackChain(traceId: string): AttackChain {
    // traceId 기준 이벤트
    const traceEvents = this.events.filter((e) => e.traceId === traceId)

    // 동일 incidentId 이벤트도 포함
    const incidentIds = new Set(traceEvents.map((e) => e.incidentId).filter(Boolean))
    const incidentEvents = this.events.filter(
      (e) => e.incidentId && incidentIds.has(e.incidentId) && e.traceId !== traceId,
    )

    // union + 중복 제거 + 시간 순 정렬
    const seen = new Set<string>()
    const allEvents: SecurityEvent[] = []
    for (const e of [...traceEvents, ...incidentEvents]) {
      if (!seen.has(e.eventId)) {
        seen.add(e.eventId)
        allEvents.push(e)
      }
    }
    allEvents.sort((a, b) => a.timestamp - b.timestamp)

    // Design Ref: §3.3 MITRE 매핑
    const mitreSet = new Set<string>()
    for (const e of allEvents) {
      const tactic = MITRE_MAP[e.action]
      if (tactic) mitreSet.add(tactic)
    }

    const chain: AttackChain = { traceId, events: allEvents, mitreMapping: [...mitreSet] }
    this.appendAudit('attackchain.build', { traceId, eventCount: allEvents.length, mitreCount: mitreSet.size })
    return chain
  }

  // Plan SC: FR-R151.4 — MITRE 매핑 단독 조회
  getMitreMapping(action: string): string | null {
    return MITRE_MAP[action] ?? null
  }

  // Plan SC: FR-R151.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
