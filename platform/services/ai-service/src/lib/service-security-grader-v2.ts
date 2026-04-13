// Design Ref: §R459 — AI기반 자동 서비스 보안 등급 산정 v2
// Plan SC: SVC-AI-ADV-R459-SC01

export type SecurityGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type SecurityControl = 'AUTH' | 'ENCRYPTION' | 'INPUT_VALIDATION' | 'AUDIT_LOG' | 'ACCESS_CONTROL' | 'NETWORK' | 'PATCH_MANAGEMENT'

export interface SecurityCheckItem {
  control: SecurityControl
  implemented: boolean
  strength: 'NONE' | 'WEAK' | 'ADEQUATE' | 'STRONG'
  notes?: string
}

export interface ServiceSecurityProfile {
  serviceId: string
  name: string
  checks: SecurityCheckItem[]
  hasKnownVulnerabilities: boolean
  lastPenTestDaysAgo?: number
}

export interface SecurityGradeReport {
  serviceId: string
  grade: SecurityGrade
  score: number        // 0..100
  passedControls: SecurityControl[]
  failedControls: SecurityControl[]
  criticalFindings: string[]
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

const CONTROL_WEIGHT: Record<SecurityControl, number> = {
  AUTH: 20, ENCRYPTION: 20, INPUT_VALIDATION: 15, AUDIT_LOG: 10,
  ACCESS_CONTROL: 15, NETWORK: 10, PATCH_MANAGEMENT: 10,
}

const STRENGTH_SCORE: Record<string, number> = {
  NONE: 0, WEAK: 0.3, ADEQUATE: 0.7, STRONG: 1.0,
}

export class ServiceSecurityGraderV2 {
  private profiles = new Map<string, ServiceSecurityProfile>()
  private auditLog: AuditEntry[] = []

  registerProfile(profile: ServiceSecurityProfile): void {
    this.profiles.set(profile.serviceId, profile)
    this.appendAudit('profile.register', profile.serviceId, { name: profile.name, checkCount: profile.checks.length })
  }

  grade(serviceId: string): SecurityGradeReport {
    const profile = this.profiles.get(serviceId)
    if (!profile) throw new Error(`Unknown service: ${serviceId}`)

    this.appendAudit('security.grade', serviceId, { hasVulns: profile.hasKnownVulnerabilities })

    const passedControls: SecurityControl[] = []
    const failedControls: SecurityControl[] = []
    const criticalFindings: string[] = []
    const recommendations: string[] = []

    let weightedScore = 0

    for (const check of profile.checks) {
      const weight = CONTROL_WEIGHT[check.control] ?? 10
      const strengthScore = STRENGTH_SCORE[check.strength] ?? 0
      const controlScore = check.implemented ? strengthScore * weight : 0

      weightedScore += controlScore

      if (check.implemented && check.strength !== 'NONE' && check.strength !== 'WEAK') {
        passedControls.push(check.control)
      } else {
        failedControls.push(check.control)
        if (check.strength === 'WEAK') {
          recommendations.push(`${check.control}: 취약한 구현 — 강화 필요`)
        } else if (!check.implemented) {
          if (check.control === 'AUTH' || check.control === 'ENCRYPTION') {
            criticalFindings.push(`${check.control} 미구현 — 즉시 적용 필수`)
          } else {
            recommendations.push(`${check.control} 미구현 — 구현 권장`)
          }
        }
      }
    }

    let score = Math.round(weightedScore)

    // 알려진 취약점 감점
    if (profile.hasKnownVulnerabilities) {
      score = Math.max(0, score - 20)
      criticalFindings.push('알려진 취약점 존재 — 즉시 패치 필요')
    }

    // 최근 침투 테스트 여부
    if (profile.lastPenTestDaysAgo === undefined || profile.lastPenTestDaysAgo > 365) {
      recommendations.push('1년 이상 침투 테스트 미실시 — 연간 침투 테스트 권장')
    }

    score = Math.max(0, Math.min(100, score))

    const grade: SecurityGrade =
      score >= 90 ? 'A'
        : score >= 75 ? 'B'
        : score >= 60 ? 'C'
        : score >= 40 ? 'D'
        : 'F'

    return { serviceId, grade, score, passedControls, failedControls, criticalFindings, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
