// Design Ref: §핵심 알고리즘 — 위험 점수 계산, 고위험 계약 목록
// Plan SC: SVC-AI-ADV-R407
export type DataGrade = 'O' | 'C' | 'S'
export type ClauseSeverity = 'critical' | 'high' | 'medium' | 'low'

const RISK_SCORE: Record<ClauseSeverity, number> = { critical: 30, high: 20, medium: 10, low: 5 }

export interface RiskClause {
  contractId: string
  clauseType: string
  severity: ClauseSeverity
}

export interface RiskScoreResult {
  contractId: string
  title: string
  riskScore: number
  clauseCount: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ContractRiskAnalyzerAI {
  private contracts = new Map<string, { title: string; contractType: string }>()
  private clauses = new Map<string, RiskClause[]>()
  private auditLog: AuditEntry[] = []

  registerContract(id: string, title: string, contractType: string): void {
    if (!id || !title || !contractType) throw new Error('id, title, contractType은 필수')
    this.contracts.set(id, { title, contractType })
    this.clauses.set(id, [])
    this.auditLog.push({ action: 'contract.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordRiskClause(contractId: string, clauseType: string, severity: ClauseSeverity, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 계약 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.contracts.has(contractId)) throw new Error(`contractId 없음: ${contractId}`)
    this.clauses.get(contractId)!.push({ contractId, clauseType, severity })
    this.auditLog.push({ action: 'clause.record', timestamp: new Date().toISOString(), detail: `${contractId}:${clauseType}:${severity}` })
  }

  getRiskScore(contractId: string): RiskScoreResult {
    const contract = this.contracts.get(contractId)
    if (!contract) throw new Error(`contractId 없음: ${contractId}`)
    const clauseList = this.clauses.get(contractId) ?? []
    const riskScore = clauseList.reduce((s, c) => s + RISK_SCORE[c.severity], 0)
    return { contractId, title: contract.title, riskScore, clauseCount: clauseList.length }
  }

  getHighRiskContracts(threshold = 50): RiskScoreResult[] {
    return [...this.contracts.keys()]
      .map((id) => this.getRiskScore(id))
      .filter((r) => r.riskScore >= threshold)
      .sort((a, b) => b.riskScore - a.riskScore)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
