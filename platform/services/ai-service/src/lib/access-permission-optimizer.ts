/**
 * AI 기반 접근 권한 자동 최적화 — SVC-AI-ADV-R184
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R184/SVC-AI-ADV-R184.design.md
 * Plan SC: FR-R184.1 ~ FR-R184.5
 *
 * 사용자 권한 사용 이력 분석 → 미사용 권한 탐지 → 최소 권한 권고.
 * CSAP D-08, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface UserPermissions {
  userId: string
  permissions: string[]
}

export interface PermissionUsageEvent {
  userId: string
  permission: string
  usedAt: number
}

export type RiskLevel = 'low' | 'medium' | 'high'

export interface PermissionAnalysis {
  userId: string
  grantedPermissions: string[]
  usedPermissions: string[]
  unusedPermissions: string[]
  minimumPermissionSet: string[]
  riskLevel: RiskLevel
  recommendations: string[]
}

export interface APOAuditEntry {
  action: 'userRegistered' | 'usageRecorded' | 'analyzed'
  timestamp: number
  details: Record<string, unknown>
}

export class AccessPermissionOptimizer {
  private readonly users = new Map<string, UserPermissions>()
  private readonly usageEvents = new Map<string, PermissionUsageEvent[]>()
  private readonly auditLog: APOAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 접근 권한 최적화 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R184.1 */
  registerUser(user: UserPermissions): void {
    if (!user.userId.trim()) throw new Error('userId must not be empty')
    this.users.set(user.userId, { ...user, permissions: [...user.permissions] })
    this.audit('userRegistered', { userId: user.userId, permissions: user.permissions.length })
  }

  /** FR-R184.2 */
  recordUsage(event: PermissionUsageEvent): void {
    if (!this.users.has(event.userId)) throw new Error(`unknown user: ${event.userId}`)
    const arr = this.usageEvents.get(event.userId) ?? []
    arr.push({ ...event })
    this.usageEvents.set(event.userId, arr)
    this.audit('usageRecorded', { userId: event.userId, permission: event.permission })
  }

  /** FR-R184.3 ~ FR-R184.4 */
  analyzeUser(userId: string, sinceMs: number): PermissionAnalysis {
    const user = this.users.get(userId)
    if (!user) throw new Error(`unknown user: ${userId}`)

    const events = (this.usageEvents.get(userId) ?? []).filter((e) => e.usedAt >= sinceMs)
    const usedSet = new Set(events.map((e) => e.permission))
    const granted = user.permissions
    const used = granted.filter((p) => usedSet.has(p))
    const unused = granted.filter((p) => !usedSet.has(p))

    const riskLevel: RiskLevel =
      unused.length >= 5 ? 'high' : unused.length >= 2 ? 'medium' : 'low'

    const recommendations: string[] = []
    if (unused.length > 0) {
      recommendations.push(`${unused.length}개 미사용 권한 제거 권고: ${unused.slice(0, 3).join(', ')}${unused.length > 3 ? ' 외' : ''}`)
    }
    if (riskLevel === 'high') {
      recommendations.push('과도한 권한 부여 상태 — 즉시 검토 필요 (CSAP D-08)')
    }

    const analysis: PermissionAnalysis = {
      userId,
      grantedPermissions: granted,
      usedPermissions: used,
      unusedPermissions: unused,
      minimumPermissionSet: used,
      riskLevel,
      recommendations,
    }

    this.audit('analyzed', { userId, unused: unused.length, riskLevel })
    return analysis
  }

  /** 전체 사용자 분석 */
  analyzeAll(sinceMs: number): PermissionAnalysis[] {
    return [...this.users.keys()].map((uid) => this.analyzeUser(uid, sinceMs))
  }

  /** FR-R184.5 */
  getAuditLog(): readonly APOAuditEntry[] {
    return [...this.auditLog]
  }

  private audit(action: APOAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
