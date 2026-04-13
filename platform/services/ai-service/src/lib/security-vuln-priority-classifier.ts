// Design Ref: §R319 — AI기반 보안 취약점 우선순위 분류
// Plan SC: SC-R319

export interface Vulnerability {
  vulnId: string
  title: string
  cvssScore: number
  exploitabilityScore: number
  isExploitedInWild: boolean
  affectedAssetCriticality: 'HIGH' | 'MEDIUM' | 'LOW'
  patchAvailable: boolean
  category: 'INJECTION' | 'XSS' | 'AUTH' | 'CRYPTO' | 'MISCONFIG' | 'EXPOSURE' | 'OTHER'
}

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL'

export interface ClassifiedVulnerability {
  vulnId: string
  title: string
  priorityLevel: PriorityLevel
  priorityScore: number
  remediationDeadlineDays: number
  remediationActions: string[]
}

export interface PriorityReport {
  totalCount: number
  criticalCount: number
  highCount: number
  classified: ClassifiedVulnerability[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

const DEADLINE_BY_PRIORITY: Record<PriorityLevel, number> = {
  CRITICAL: 1,
  HIGH: 7,
  MEDIUM: 30,
  LOW: 90,
  INFORMATIONAL: 365,
}

export class SecurityVulnPriorityClassifier {
  private vulnerabilities = new Map<string, Vulnerability>()
  private auditLog: AuditEntry[] = []

  registerVulnerability(vuln: Vulnerability): void {
    this.vulnerabilities.set(vuln.vulnId, vuln)
    this.auditLog.push({ action: 'vuln.register', timestamp: new Date().toISOString(), detail: vuln.vulnId })
  }

  classify(): PriorityReport {
    const classified: ClassifiedVulnerability[] = []

    for (const vuln of this.vulnerabilities.values()) {
      let score = vuln.cvssScore * 10

      // 실제 악용 중이면 가중치
      if (vuln.isExploitedInWild) score += 20

      // 자산 중요도 가중치
      if (vuln.affectedAssetCriticality === 'HIGH') score += 15
      else if (vuln.affectedAssetCriticality === 'MEDIUM') score += 8

      // 익스플로이터빌리티
      score += vuln.exploitabilityScore * 5

      score = Math.min(score, 100)

      let priorityLevel: PriorityLevel
      if (score >= 90) priorityLevel = 'CRITICAL'
      else if (score >= 70) priorityLevel = 'HIGH'
      else if (score >= 50) priorityLevel = 'MEDIUM'
      else if (score >= 30) priorityLevel = 'LOW'
      else priorityLevel = 'INFORMATIONAL'

      const remediationActions: string[] = []
      if (vuln.patchAvailable) {
        remediationActions.push('패치 즉시 적용')
      } else {
        remediationActions.push('임시 완화 조치 적용 (WAF 규칙, 방화벽 차단)')
      }

      if (vuln.category === 'INJECTION') remediationActions.push('입력 검증 강화 (CSAP D-12)')
      if (vuln.category === 'AUTH') remediationActions.push('인증·인가 로직 점검 (CSAP D-08)')
      if (vuln.category === 'CRYPTO') remediationActions.push('암호화 강도 검토 (CSAP D-09)')
      if (vuln.isExploitedInWild) remediationActions.push('보안관제 모니터링 강화')

      classified.push({
        vulnId: vuln.vulnId,
        title: vuln.title,
        priorityLevel,
        priorityScore: Math.round(score),
        remediationDeadlineDays: DEADLINE_BY_PRIORITY[priorityLevel],
        remediationActions,
      })
    }

    classified.sort((a, b) => b.priorityScore - a.priorityScore)

    const criticalCount = classified.filter((v) => v.priorityLevel === 'CRITICAL').length
    const highCount = classified.filter((v) => v.priorityLevel === 'HIGH').length

    this.auditLog.push({ action: 'vuln.classify', timestamp: new Date().toISOString(), detail: `total=${classified.length}` })
    return { totalCount: classified.length, criticalCount, highCount, classified }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
