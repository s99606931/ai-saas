// Design Ref: §R236 — AI기반 사용자 권한 자동 추천
// Plan SC: SVC-AI-ADV-R236-SC01
// CSAP D-08: 최소 권한 원칙 자동 적용

export type RoleLevel = 'VIEWER' | 'USER' | 'OPERATOR' | 'ADMIN'
export type Department = string

export interface UserProfile {
  userId: string
  name: string
  department: Department
  jobTitle: string
  currentRoles: RoleLevel[]
}

export interface AccessPattern {
  userId: string
  resource: string
  action: 'READ' | 'WRITE' | 'DELETE' | 'ADMIN'
  frequency: number  // 접근 횟수
}

export interface PermissionRecommendation {
  userId: string
  currentRoles: RoleLevel[]
  recommendedRoles: RoleLevel[]
  addRoles: RoleLevel[]
  removeRoles: RoleLevel[]
  reason: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

interface AuditEntry {
  timestamp: string
  action: string
  userId: string
  detail: Record<string, unknown>
}

const ROLE_RANK: Record<RoleLevel, number> = { VIEWER: 0, USER: 1, OPERATOR: 2, ADMIN: 3 }

function inferRequiredRoles(patterns: AccessPattern[]): RoleLevel[] {
  const hasAdmin = patterns.some((p) => p.action === 'ADMIN')
  const hasDelete = patterns.some((p) => p.action === 'DELETE')
  const hasWrite = patterns.some((p) => p.action === 'WRITE')
  const hasRead = patterns.some((p) => p.action === 'READ')

  if (hasAdmin) return ['ADMIN']
  if (hasDelete) return ['OPERATOR']
  if (hasWrite) return ['USER']
  if (hasRead) return ['VIEWER']
  return ['VIEWER']
}

export class PermissionRecommendationAi {
  private users = new Map<string, UserProfile>()
  private patterns = new Map<string, AccessPattern[]>()
  private auditLog: AuditEntry[] = []

  registerUser(profile: UserProfile): void {
    this.users.set(profile.userId, profile)
    this.patterns.set(profile.userId, [])
    this.appendAudit('user.register', profile.userId, { department: profile.department, jobTitle: profile.jobTitle })
  }

  recordPattern(pattern: AccessPattern): void {
    if (!this.users.has(pattern.userId)) throw new Error(`Unknown user: ${pattern.userId}`)
    const list = this.patterns.get(pattern.userId) ?? []
    list.push(pattern)
    this.patterns.set(pattern.userId, list)
  }

  recommend(userId: string): PermissionRecommendation {
    const user = this.users.get(userId)
    if (!user) throw new Error(`Unknown user: ${userId}`)

    const accessPatterns = this.patterns.get(userId) ?? []
    const recommendedRoles = inferRequiredRoles(accessPatterns)
    const currentRoles = user.currentRoles

    const currentMaxRank = Math.max(...currentRoles.map((r) => ROLE_RANK[r]))
    const recommendedMaxRank = Math.max(...recommendedRoles.map((r) => ROLE_RANK[r]))

    const addRoles = recommendedRoles.filter((r) => !currentRoles.includes(r))
    const removeRoles = currentRoles.filter((r) => !recommendedRoles.includes(r))

    const rankDiff = currentMaxRank - recommendedMaxRank
    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
      rankDiff >= 2 ? 'HIGH' :
      rankDiff >= 1 ? 'MEDIUM' : 'LOW'

    let reason = '실제 접근 패턴 기반 최소 권한 원칙 적용'
    if (rankDiff > 0) reason += ` — 현재 권한이 실제 사용보다 ${rankDiff}단계 높음`
    if (addRoles.length > 0) reason += ` — 추가 필요: ${addRoles.join(', ')}`

    this.appendAudit('permission.recommend', userId, { recommendedRoles, riskLevel, addRoles, removeRoles })

    return { userId, currentRoles, recommendedRoles, addRoles, removeRoles, reason, riskLevel }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, userId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, userId, detail })
  }
}
