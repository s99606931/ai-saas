// Design Ref: SVC-AI-ADV-R624 — AI기반 마이크로서비스 자동 발견 v3 (impl v4)
// Plan SC: FR-R624.1~5
import { createHash } from 'crypto'

interface ServiceNode {
  serviceId: string
  endpoint: string
  healthScore: number // 0..100
  lastSeen: number
}

interface AuditEntry {
  timestamp: string
  action: string
  actor?: string
  details?: Record<string, unknown>
}

type Health = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'

interface DiscoveryResult {
  serviceId: string
  health: Health
  staleness: number // ms since lastSeen
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

export class MicroserviceAutodiscoveryV4 {
  private services = new Map<string, ServiceNode>()
  private auditLog: AuditEntry[] = []

  register(service: ServiceNode, dataGrade?: 'C' | 'S' | 'O'): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.services.set(service.serviceId, { ...service })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_SERVICE',
      actor: maskPII(service.serviceId),
      details: { endpoint: service.endpoint, healthScore: service.healthScore },
    })
  }

  heartbeat(serviceId: string, healthScore: number, now: number = Date.now()): void {
    const s = this.services.get(serviceId)
    if (!s) return
    s.healthScore = healthScore
    s.lastSeen = now
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'HEARTBEAT',
      actor: maskPII(serviceId),
      details: { healthScore },
    })
  }

  discover(now: number = Date.now()): DiscoveryResult[] {
    const out: DiscoveryResult[] = []
    for (const s of this.services.values()) {
      const staleness = now - s.lastSeen
      let health: Health
      if (staleness > 60_000 || s.healthScore < 50) health = 'UNHEALTHY'
      else if (staleness > 30_000 || s.healthScore < 80) health = 'DEGRADED'
      else health = 'HEALTHY'
      out.push({ serviceId: maskPII(s.serviceId), health, staleness })
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'DISCOVER',
      details: { count: out.length },
    })
    return out
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
