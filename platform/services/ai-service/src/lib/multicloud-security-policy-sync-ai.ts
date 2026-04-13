// Design Ref: §핵심 알고리즘 — 정책 불일치 탐지, 동기화 상태
// Plan SC: SVC-AI-ADV-R409
export type DataGrade = 'O' | 'C' | 'S'

export interface PolicyMismatch {
  policyType: string
  values: Record<string, string>
}

export interface SyncStatus {
  totalPolicies: number
  syncedPolicies: number
  mismatchedPolicies: number
  syncRate: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class MulticloudSecurityPolicySyncAI {
  private clouds = new Map<string, { name: string; provider: string }>()
  private policies = new Map<string, Map<string, string>>() // cloudId → Map<policyType, value>
  private auditLog: AuditEntry[] = []

  registerCloud(id: string, name: string, provider: string): void {
    if (!id || !name || !provider) throw new Error('id, name, provider는 필수')
    this.clouds.set(id, { name, provider })
    this.policies.set(id, new Map())
    this.auditLog.push({ action: 'cloud.register', timestamp: new Date().toISOString(), detail: `${provider}:${id}` })
  }

  setPolicy(cloudId: string, policyType: string, value: string, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 보안 정책 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.clouds.has(cloudId)) throw new Error(`cloudId 없음: ${cloudId}`)
    this.policies.get(cloudId)!.set(policyType, value)
    this.auditLog.push({ action: 'policy.set', timestamp: new Date().toISOString(), detail: `${cloudId}:${policyType}=${value}` })
  }

  getPolicyMismatches(): PolicyMismatch[] {
    const allTypes = new Set<string>()
    for (const pMap of this.policies.values()) {
      for (const type of pMap.keys()) allTypes.add(type)
    }
    const mismatches: PolicyMismatch[] = []
    for (const policyType of allTypes) {
      const values: Record<string, string> = {}
      for (const [cloudId, pMap] of this.policies) {
        if (pMap.has(policyType)) values[cloudId] = pMap.get(policyType)!
      }
      const uniqueValues = new Set(Object.values(values))
      if (uniqueValues.size > 1) mismatches.push({ policyType, values })
    }
    return mismatches
  }

  getPolicySyncStatus(): SyncStatus {
    const allTypes = new Set<string>()
    for (const pMap of this.policies.values()) {
      for (const type of pMap.keys()) allTypes.add(type)
    }
    const totalPolicies = allTypes.size
    const mismatched = this.getPolicyMismatches().length
    const synced = totalPolicies - mismatched
    const syncRate = totalPolicies === 0 ? 100 : Math.round((synced / totalPolicies) * 10000) / 100
    return { totalPolicies, syncedPolicies: synced, mismatchedPolicies: mismatched, syncRate }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
