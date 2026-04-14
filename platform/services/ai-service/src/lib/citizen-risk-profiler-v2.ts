/**
 * Citizen Risk Profiler V2 — SVC-AI-ADV-R659 (트랙 A 24차)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R659.design.md
 * Plan SC: FR-R659.1 ~ FR-R659.6
 *
 * 민원인 위험 프로파일 + 우선 응대 큐.
 * N2SF N-05: C/S 등급 차단. citizenId SHA-256 마스킹.
 */

import { createHash } from 'crypto'

export type DataGrade = 'C' | 'S' | 'O'
export type EventType = 'complaint' | 'call' | 'visit' | 'message'
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface CitizenEvent {
  citizenIdHash: string
  eventType: EventType
  text: string
  timestamp: string
}

export interface RiskProfile {
  citizenIdHash: string
  eventCount: number
  threatKeywordCount: number
  score: number
  level: RiskLevel
}

export interface AuditEntry {
  timestamp: string
  action: string
  citizenIdHash: string
  detail: Record<string, unknown>
}

const THREAT_KEYWORDS = ['협박', '자해', '폭력', '고소', '시위']

export class CitizenRiskProfilerV2 {
  private readonly events = new Map<string, CitizenEvent[]>() // hash -> events
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R659.1 + FR-R659.4
  recordEvent(
    citizenId: string,
    eventType: EventType,
    text: string,
    grade: DataGrade = 'O',
  ): CitizenEvent {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const hash = this.hashCitizenId(citizenId)
    const event: CitizenEvent = {
      citizenIdHash: hash,
      eventType,
      text,
      timestamp: new Date().toISOString(),
    }
    if (!this.events.has(hash)) this.events.set(hash, [])
    this.events.get(hash)!.push(event)
    this.appendAudit('event.record', hash, { eventType })
    return { ...event }
  }

  // Plan SC: FR-R659.2 + FR-R659.3
  getProfile(citizenId: string): RiskProfile {
    const hash = this.hashCitizenId(citizenId)
    const events = this.events.get(hash) ?? []
    let threatCount = 0
    for (const e of events) {
      for (const k of THREAT_KEYWORDS) {
        if (e.text.includes(k)) threatCount += 1
      }
    }
    const score = events.length + threatCount * 3
    const level: RiskLevel = score >= 10 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW'
    return {
      citizenIdHash: hash,
      eventCount: events.length,
      threatKeywordCount: threatCount,
      score,
      level,
    }
  }

  // Plan SC: FR-R659.5
  getPriorityQueue(): RiskProfile[] {
    const profiles: RiskProfile[] = []
    for (const hash of this.events.keys()) {
      profiles.push(this.profileByHash(hash))
    }
    const order: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    return profiles.sort((a, b) => {
      const diff = order[a.level] - order[b.level]
      return diff !== 0 ? diff : b.score - a.score
    })
  }

  // Plan SC: FR-R659.6 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private profileByHash(hash: string): RiskProfile {
    const events = this.events.get(hash) ?? []
    let threatCount = 0
    for (const e of events) {
      for (const k of THREAT_KEYWORDS) {
        if (e.text.includes(k)) threatCount += 1
      }
    }
    const score = events.length + threatCount * 3
    const level: RiskLevel = score >= 10 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW'
    return { citizenIdHash: hash, eventCount: events.length, threatKeywordCount: threatCount, score, level }
  }

  private hashCitizenId(id: string): string {
    return createHash('sha256').update(id).digest('hex').substring(0, 16)
  }

  private appendAudit(action: string, citizenIdHash: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, citizenIdHash, detail })
  }
}
