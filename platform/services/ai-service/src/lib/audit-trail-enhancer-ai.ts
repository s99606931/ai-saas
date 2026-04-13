// Design Ref: §핵심 알고리즘 — 위험 패턴 탐지, PII 마스킹
// Plan SC: SVC-AI-ADV-R327
import { createHash } from 'node:crypto'

export type DataGrade = 'O' | 'C' | 'S'
export type AlertType = 'suspicious_frequency' | 'unauthorized_access'

export interface AuditPolicy {
  id: string
  name: string
  allowedResources: string[]
  maxEventsPerWindow: number
  windowMs: number
}

export interface EnhancedAuditEntry {
  policyId: string
  maskedActorId: string
  resource: string
  action: string
  timestamp: number
}

export interface RiskAlert {
  policyId: string
  alertType: AlertType
  maskedActorId: string
  resource: string
  eventCount?: number
  timestamp: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskActorId(actorId: string): string {
  return createHash('sha256').update(actorId).digest('hex').substring(0, 16)
}

export class AuditTrailEnhancerAI {
  private policies = new Map<string, AuditPolicy>()
  private enhancedLog: EnhancedAuditEntry[] = []
  private riskAlerts: RiskAlert[] = []
  private auditLog: AuditEntry[] = []

  registerPolicy(
    id: string,
    name: string,
    allowedResources: string[],
    maxEventsPerWindow: number,
    windowMs: number
  ): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    this.policies.set(id, { id, name, allowedResources, maxEventsPerWindow, windowMs })
    this.auditLog.push({ action: 'policy.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordEvent(policyId: string, actorId: string, resource: string, action: string, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 감사 데이터 직접 전송 금지 (N2SF N-05)`)
    }
    const policy = this.policies.get(policyId)
    if (!policy) throw new Error(`policyId 없음: ${policyId}`)
    const masked = maskActorId(actorId)
    const now = Date.now()
    const entry: EnhancedAuditEntry = { policyId, maskedActorId: masked, resource, action, timestamp: now }
    this.enhancedLog.push(entry)
    this.auditLog.push({ action: 'event.record', timestamp: new Date().toISOString(), detail: `${policyId}:${masked}` })

    // 허가되지 않은 접근 탐지
    if (!policy.allowedResources.includes(resource)) {
      this.riskAlerts.push({ policyId, alertType: 'unauthorized_access', maskedActorId: masked, resource, timestamp: now })
    }

    // 시간 창 내 빈도 탐지
    const windowStart = now - policy.windowMs
    const recentEvents = this.enhancedLog.filter(
      (e) => e.policyId === policyId && e.maskedActorId === masked && e.timestamp >= windowStart
    )
    if (recentEvents.length > policy.maxEventsPerWindow) {
      this.riskAlerts.push({
        policyId,
        alertType: 'suspicious_frequency',
        maskedActorId: masked,
        resource,
        eventCount: recentEvents.length,
        timestamp: now,
      })
    }
  }

  getRiskAlerts(policyId: string): RiskAlert[] {
    return this.riskAlerts.filter((a) => a.policyId === policyId)
  }

  getEnhancedLog(): EnhancedAuditEntry[] {
    return [...this.enhancedLog]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
