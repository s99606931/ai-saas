// Design Ref: §R210 — AI기반 사용자 인터페이스 개인화 엔진
// Plan SC: SVC-AI-ADV-R210-SC01

export interface UserProfile {
  userId: string
  department: string
  role: string
  preferredLanguage: string
  accessibilityNeeds: string[]
}

export interface UsageEvent {
  userId: string
  feature: string
  durationMs: number
  timestamp: string
}

export interface PersonalizationConfig {
  userId: string
  recommendedFeatures: string[]
  layoutPreference: 'COMPACT' | 'COMFORTABLE' | 'SPACIOUS'
  highContrastMode: boolean
  fontSize: 'SMALL' | 'MEDIUM' | 'LARGE'
  topModules: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  userId: string
  detail: Record<string, unknown>
}

export class UiPersonalizationEngine {
  private profiles = new Map<string, UserProfile>()
  private usageHistory = new Map<string, UsageEvent[]>()
  private auditLog: AuditEntry[] = []

  registerUser(profile: UserProfile): void {
    this.profiles.set(profile.userId, profile)
    this.usageHistory.set(profile.userId, [])
    this.appendAudit('user.register', profile.userId, { department: profile.department })
  }

  recordUsage(event: UsageEvent): void {
    if (!this.profiles.has(event.userId)) throw new Error(`Unknown user: ${event.userId}`)
    const history = this.usageHistory.get(event.userId) ?? []
    history.push(event)
    this.usageHistory.set(event.userId, history)
  }

  personalize(userId: string): PersonalizationConfig {
    const profile = this.profiles.get(userId)
    if (!profile) throw new Error(`Unknown user: ${userId}`)

    const history = this.usageHistory.get(userId) ?? []

    // 접근성 설정
    const highContrastMode = profile.accessibilityNeeds.includes('high_contrast')
    const fontSize: PersonalizationConfig['fontSize'] =
      profile.accessibilityNeeds.includes('large_font') ? 'LARGE'
        : profile.accessibilityNeeds.includes('small_font') ? 'SMALL'
        : 'MEDIUM'

    // 사용 빈도 기반 상위 모듈
    const featureCounts = new Map<string, number>()
    for (const event of history) {
      featureCounts.set(event.feature, (featureCounts.get(event.feature) ?? 0) + 1)
    }
    const topModules = Array.from(featureCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([feature]) => feature)

    // 레이아웃 추천 — 역할 기반
    const layoutPreference: PersonalizationConfig['layoutPreference'] =
      profile.role === 'ADMIN' ? 'COMPACT' : profile.role === 'VIEWER' ? 'SPACIOUS' : 'COMFORTABLE'

    // 추천 기능 — 역할 기반
    const recommendedFeatures = this.getRecommendedFeatures(profile.role, topModules)

    this.appendAudit('personalize', userId, { topModulesCount: topModules.length })

    return {
      userId,
      recommendedFeatures,
      layoutPreference,
      highContrastMode,
      fontSize,
      topModules,
    }
  }

  private getRecommendedFeatures(role: string, currentTop: string[]): string[] {
    const roleFeatures: Record<string, string[]> = {
      ADMIN: ['user-management', 'audit-logs', 'system-config', 'reports'],
      OPERATOR: ['monitoring', 'alerts', 'deployments', 'logs'],
      VIEWER: ['dashboard', 'reports', 'search'],
    }
    const base = roleFeatures[role] ?? ['dashboard']
    return base.filter((f) => !currentTop.includes(f)).slice(0, 3)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, userId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, userId, detail })
  }
}
