// Design Ref: SVC-AI-ADV-R625 — AI기반 API 버전 마이그레이션 v2 (impl v3)
// Plan SC: FR-R625.1~5
import { createHash } from 'crypto'

interface ApiEndpoint {
  path: string
  method: string
  version: string
  deprecated: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  actor?: string
  details?: Record<string, unknown>
}

interface MigrationPlan {
  endpointKey: string
  fromVersion: string
  toVersion: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  breakingChanges: string[]
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

function key(e: Pick<ApiEndpoint, 'path' | 'method' | 'version'>): string {
  return `${e.method.toUpperCase()} ${e.path}@${e.version}`
}

export class ApiVersionMigrationV3 {
  private endpoints = new Map<string, ApiEndpoint>()
  private auditLog: AuditEntry[] = []

  registerEndpoint(ep: ApiEndpoint, dataGrade?: 'C' | 'S' | 'O'): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.endpoints.set(key(ep), { ...ep })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_ENDPOINT',
      actor: maskPII(`${ep.method}${ep.path}`),
      details: { version: ep.version, deprecated: ep.deprecated },
    })
  }

  planMigration(from: string, to: string, breakingChanges: string[] = []): MigrationPlan[] {
    const plans: MigrationPlan[] = []
    for (const ep of this.endpoints.values()) {
      if (ep.version !== from) continue
      const priority: 'HIGH' | 'MEDIUM' | 'LOW' = ep.deprecated
        ? 'HIGH'
        : breakingChanges.length > 0
          ? 'MEDIUM'
          : 'LOW'
      plans.push({
        endpointKey: key(ep),
        fromVersion: from,
        toVersion: to,
        priority,
        breakingChanges: [...breakingChanges],
      })
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'PLAN_MIGRATION',
      details: { from, to, planCount: plans.length },
    })
    return plans
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
