// Design Ref: §설계결정 — AI기반 권한 추천 자동화 v2
// Plan SC: FR-R619.1~5
import { createHash } from 'crypto'

interface RoleRecord { roleId: string; name: string; permissions: string[] }
interface UserAccess { resourceType: string; frequency: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class PermissionRecommendationV2 {
  private roles = new Map<string, RoleRecord>()
  private userAccess = new Map<string, UserAccess[]>()
  private auditLog: AuditEntry[] = []

  registerRole(roleId: string, name: string, permissions: string[]): void {
    this.roles.set(roleId, { roleId, name, permissions })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_ROLE', details: { roleId, name } })
  }

  recordAccess(userId: string, resourceType: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const maskedUserId = createHash('sha256').update(userId).digest('hex').substring(0, 16)
    const entries = this.userAccess.get(maskedUserId) ?? []
    const existing = entries.find(e => e.resourceType === resourceType)
    if (existing) {
      existing.frequency += 1
    } else {
      entries.push({ resourceType, frequency: 1 })
    }
    this.userAccess.set(maskedUserId, entries)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_ACCESS', details: { maskedUserId, resourceType } })
  }

  recommendRole(userId: string): string | null {
    const maskedUserId = createHash('sha256').update(userId).digest('hex').substring(0, 16)
    const accesses = this.userAccess.get(maskedUserId) ?? []
    if (accesses.length === 0) return null
    const topResource = accesses.sort((a, b) => b.frequency - a.frequency)[0]!.resourceType
    for (const role of this.roles.values()) {
      if (role.permissions.includes(topResource)) return role.roleId
    }
    return null
  }

  getOverPrivilegedUsers(): string[] {
    // users accessing more resource types than any single role covers
    const result: string[] = []
    for (const [maskedUserId, accesses] of this.userAccess.entries()) {
      const userResourceTypes = new Set(accesses.map(a => a.resourceType))
      const maxRoleCoverage = Math.max(0, ...Array.from(this.roles.values()).map(r => r.permissions.length))
      if (userResourceTypes.size > maxRoleCoverage) result.push(maskedUserId)
    }
    return result
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
