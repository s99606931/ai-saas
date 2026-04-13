// Design Ref: §R414 — AI기반 자동 보안 정책 갱신
// Plan SC: SC-R414

export interface CveEntry {
  cveId: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  affectedComponents: string[]
  description: string
}

export interface SecurityPolicy {
  policyId: string
  name: string
  affectedComponents: string[]
  lastUpdatedAt: string
}

export type UpdatePriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface PolicyUpdate {
  policyId: string
  policyName: string
  priority: UpdatePriority
  relatedCves: string[]
  cveScore: number
  recommendation: string
  autoRemediable: boolean
}

export interface PolicyUpdateReport {
  totalPolicies: number
  urgentCount: number
  policyUpdates: PolicyUpdate[]
  immediateActions: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

const CVE_SCORES: Record<CveEntry['severity'], number> = {
  CRITICAL: 40,
  HIGH: 30,
  MEDIUM: 15,
  LOW: 5,
}

export class SecurityPolicyAutoUpdater {
  private cves: CveEntry[] = []
  private policies = new Map<string, SecurityPolicy>()
  private auditLog: AuditEntry[] = []

  registerCve(cve: CveEntry): void {
    this.cves.push(cve)
    this.auditLog.push({ action: 'cve.register', timestamp: new Date().toISOString(), detail: `${cve.cveId}:${cve.severity}` })
  }

  registerPolicy(policy: SecurityPolicy): void {
    this.policies.set(policy.policyId, policy)
    this.auditLog.push({ action: 'policy.register', timestamp: new Date().toISOString(), detail: policy.policyId })
  }

  update(): PolicyUpdateReport {
    const policyUpdates: PolicyUpdate[] = []
    const immediateActions: string[] = []

    for (const policy of this.policies.values()) {
      const relatedCves = this.cves.filter((cve) =>
        cve.affectedComponents.some((comp) => policy.affectedComponents.includes(comp))
      )
      if (relatedCves.length === 0) continue

      const cveScore = relatedCves.reduce((s, cve) => s + CVE_SCORES[cve.severity], 0)
      const priority: UpdatePriority = cveScore >= 40 ? 'URGENT' : cveScore >= 20 ? 'HIGH' : cveScore >= 10 ? 'MEDIUM' : 'LOW'
      const hasCritical = relatedCves.some((c) => c.severity === 'CRITICAL')
      const autoRemediable = !hasCritical

      policyUpdates.push({
        policyId: policy.policyId,
        policyName: policy.name,
        priority,
        relatedCves: relatedCves.map((c) => c.cveId),
        cveScore,
        recommendation: `${priority} 우선순위 갱신 — 연관 CVE ${relatedCves.length}개`,
        autoRemediable,
      })

      if (priority === 'URGENT') {
        immediateActions.push(`즉시 갱신: ${policy.name} (CVE 점수 ${cveScore})`)
      }
    }

    policyUpdates.sort((a, b) => b.cveScore - a.cveScore)
    const urgentCount = policyUpdates.filter((p) => p.priority === 'URGENT').length

    this.auditLog.push({ action: 'policy.update', timestamp: new Date().toISOString(), detail: `urgent=${urgentCount}` })
    return {
      totalPolicies: this.policies.size,
      urgentCount,
      policyUpdates,
      immediateActions,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
