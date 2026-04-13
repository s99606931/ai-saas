// Design Ref: §R337 — AI기반 공공 계약 자동 분석 v2
// Plan SC: SC-R337

export interface ContractClause {
  clauseId: string
  type: 'PAYMENT' | 'PENALTY' | 'TERMINATION' | 'IP_RIGHTS' | 'LIABILITY' | 'CONFIDENTIALITY'
  content: string
  isOnerous: boolean
  riskKeywords: string[]
}

export interface PublicContract {
  contractId: string
  title: string
  contractorName: string
  totalValue: number
  durationDays: number
  clauses: ContractClause[]
  isPublicProcurement: boolean
}

export type ContractRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface ClauseRisk {
  clauseId: string
  type: ContractClause['type']
  riskLevel: ContractRiskLevel
  findings: string[]
  suggestions: string[]
}

export interface ContractAnalysis {
  contractId: string
  overallRisk: ContractRiskLevel
  riskScore: number
  clauseRisks: ClauseRisk[]
  complianceFlags: string[]
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class PublicContractAnalyzerV2 {
  private contracts = new Map<string, PublicContract>()
  private auditLog: AuditEntry[] = []

  registerContract(contract: PublicContract): void {
    this.contracts.set(contract.contractId, contract)
    this.auditLog.push({ action: 'contract.register', timestamp: new Date().toISOString(), detail: contract.contractId })
  }

  analyze(contractId: string): ContractAnalysis {
    const contract = this.contracts.get(contractId)
    if (!contract) throw new Error(`Contract not found: ${contractId}`)

    const clauseRisks: ClauseRisk[] = []
    const complianceFlags: string[] = []
    let totalRiskScore = 0

    for (const clause of contract.clauses) {
      let riskScore = 0
      const findings: string[] = []
      const suggestions: string[] = []

      if (clause.isOnerous) {
        riskScore += 30
        findings.push('불리한 조항 감지')
        suggestions.push('법무팀 검토 후 조항 수정 협의 필요')
      }

      if (clause.riskKeywords.length > 0) {
        riskScore += clause.riskKeywords.length * 10
        findings.push(`위험 키워드 ${clause.riskKeywords.length}개 감지: ${clause.riskKeywords.join(', ')}`)
      }

      if (clause.type === 'PENALTY' && clause.isOnerous) {
        riskScore += 20
        findings.push('과도한 위약금 조항')
        suggestions.push('위약금 상한선 협의 필요')
      }

      if (clause.type === 'LIABILITY' && clause.isOnerous) {
        riskScore += 25
        findings.push('무제한 책임 조항 위험')
        suggestions.push('책임 한도 명시 협의')
      }

      let riskLevel: ContractRiskLevel
      if (riskScore >= 60) riskLevel = 'CRITICAL'
      else if (riskScore >= 40) riskLevel = 'HIGH'
      else if (riskScore >= 20) riskLevel = 'MEDIUM'
      else riskLevel = 'LOW'

      totalRiskScore += riskScore
      clauseRisks.push({ clauseId: clause.clauseId, type: clause.type, riskLevel, findings, suggestions })
    }

    // 공공조달 준수 검사
    if (contract.isPublicProcurement) {
      if (contract.totalValue > 100_000_000 && !contract.clauses.some((c) => c.type === 'IP_RIGHTS')) {
        complianceFlags.push('1억 초과 공공조달 — 지식재산권 조항 누락')
      }
      if (!contract.clauses.some((c) => c.type === 'CONFIDENTIALITY')) {
        complianceFlags.push('공공계약 보안 유지 조항 누락')
      }
    }

    const avgRiskScore = contract.clauses.length > 0 ? totalRiskScore / contract.clauses.length : 0
    let overallRisk: ContractRiskLevel
    if (avgRiskScore >= 60 || complianceFlags.length >= 2) overallRisk = 'CRITICAL'
    else if (avgRiskScore >= 40 || complianceFlags.length >= 1) overallRisk = 'HIGH'
    else if (avgRiskScore >= 20) overallRisk = 'MEDIUM'
    else overallRisk = 'LOW'

    const recommendations = clauseRisks
      .filter((r) => r.riskLevel === 'CRITICAL' || r.riskLevel === 'HIGH')
      .flatMap((r) => r.suggestions)

    this.auditLog.push({ action: 'contract.analyze', timestamp: new Date().toISOString(), detail: `${contractId}:${overallRisk}` })
    return { contractId, overallRisk, riskScore: Math.round(avgRiskScore), clauseRisks, complianceFlags, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
