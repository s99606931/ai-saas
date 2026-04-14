// Design Ref: SVC-AI-ADV-R619 — AI기반 권한 추천 자동화 v2 (impl filename: v3 — v2 파일 충돌 회피)
// Plan SC: FR-R619.1~5
import { createHash } from 'crypto'

interface RoleRecord {
  roleId: string
  name: string
  permissions: string[]
}

interface AccessRecord {
  resourceType: string
  frequency: number
}

interface AuditEntry {
  timestamp: string
  action: string
  actor?: string
  details?: Record<string, unknown>
}

interface Recommendation {
  userId: string
  recommendedRoleId: string | null
  matchedPermissions: string[]
  excessPermissions: string[]
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

export class PermissionRecommendationV3 {
  private roles = new Map<string, RoleRecord>()
  private userAccess = new Map<string, AccessRecord[]>()
  private auditLog: AuditEntry[] = []

  registerRole(roleId: string, name: string, permissions: string[]): void {
    this.roles.set(roleId, { roleId, name, permissions: [...permissions] })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_ROLE',
      details: { roleId, name, permissionCount: permissions.length },
    })
  }

  recordAccess(userId: string, resourceType: string, dataGrade?: 'C' | 'S' | 'O'): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const maskedUserId = maskPII(userId)
    const entries = this.userAccess.get(maskedUserId) ?? []
    const existing = entries.find((e) => e.resourceType === resourceType)
    if (existing) {
      existing.frequency += 1
    } else {
      entries.push({ resourceType, frequency: 1 })
    }
    this.userAccess.set(maskedUserId, entries)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_ACCESS',
      details: { maskedUserId, resourceType },
    })
  }

  recommend(userId: string): Recommendation {
    const maskedUserId = maskPII(userId)
    const accesses = this.userAccess.get(maskedUserId) ?? []
    if (accesses.length === 0) {
      return { userId: maskedUserId, recommendedRoleId: null, matchedPermissions: [], excessPermissions: [] }
    }
    const userResources = new Set(accesses.map((a) => a.resourceType))

    let bestRole: RoleRecord | null = null
    let bestMatch = -1
    let bestExcess = Number.POSITIVE_INFINITY
    for (const role of this.roles.values()) {
      const matched = role.permissions.filter((p) => userResources.has(p))
      const excess = role.permissions.filter((p) => !userResources.has(p))
      // 최소 권한 원칙: 가장 많이 매칭되면서 초과 권한이 가장 적은 역할 선호
      if (matched.length > bestMatch || (matched.length === bestMatch && excess.length < bestExcess)) {
        bestRole = role
        bestMatch = matched.length
        bestExcess = excess.length
      }
    }
    if (!bestRole || bestMatch === 0) {
      return { userId: maskedUserId, recommendedRoleId: null, matchedPermissions: [], excessPermissions: [] }
    }
    const matchedPermissions = bestRole.permissions.filter((p) => userResources.has(p))
    const excessPermissions = bestRole.permissions.filter((p) => !userResources.has(p))
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECOMMEND_ROLE',
      details: { maskedUserId, recommendedRoleId: bestRole.roleId },
    })
    return {
      userId: maskedUserId,
      recommendedRoleId: bestRole.roleId,
      matchedPermissions,
      excessPermissions,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
