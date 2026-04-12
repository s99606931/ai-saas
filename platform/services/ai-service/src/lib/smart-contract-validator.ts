// Design Ref: §R255 — 스마트 계약 유효성 검사 엔진
// Plan SC: SVC-AI-ADV-R255-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type ValidationStatus = 'VALID' | 'WARN' | 'INVALID'

export interface RequiredClause {
  clauseId: string
  category: string
  keywords: string[]   // 조항 인식용 키워드 (모두 포함 시 매칭)
  description: string
}

export interface RiskKeyword {
  keyword: string
  weight: number        // 0~100
  reason: string
}

export interface ContractInput {
  contractId: string
  title: string
  parties: string[]     // 계약 당사자 식별자 (감사 로그 시 마스킹)
  amount: number
  text: string          // 계약 전문
  grade?: DataGrade
}

export interface ClauseMatch {
  clauseId: string
  category: string
  matched: boolean
  matchedKeywords: string[]
}

export interface RiskFinding {
  keyword: string
  weight: number
  reason: string
  occurrences: number
}

export interface ValidationResult {
  contractId: string
  status: ValidationStatus
  requiredTotal: number
  requiredMatched: number
  riskScore: number
  risks: RiskFinding[]
  missingClauses: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  contractIdMasked: string
  detail: Record<string, unknown>
}

export class SmartContractValidator {
  private requiredClauses = new Map<string, RequiredClause>()
  private riskKeywords: RiskKeyword[] = []
  private contracts = new Map<string, ContractInput>()
  private auditLog: AuditEntry[] = []

  registerRequiredClause(clause: RequiredClause): void {
    if (clause.keywords.length === 0) {
      throw new Error('keywords는 1개 이상이어야 합니다')
    }
    this.requiredClauses.set(clause.clauseId, clause)
    this.appendAudit('clause.register', 'SYSTEM', { clauseId: clause.clauseId })
  }

  registerRiskKeyword(risk: RiskKeyword): void {
    if (risk.weight < 0 || risk.weight > 100) {
      throw new Error('weight는 0~100 범위여야 합니다')
    }
    this.riskKeywords.push(risk)
  }

  registerContract(contract: ContractInput): void {
    if (contract.grade === 'C' || contract.grade === 'S') {
      throw new Error(`BLOCKED: ${contract.grade}등급 계약은 AI 검증 금지 (N2SF N-05)`)
    }
    if (contract.grade !== 'O') {
      throw new Error('계약은 O등급만 허용됩니다 (당사자 ID 마스킹 전제)')
    }
    if (contract.amount < 0) {
      throw new Error('amount는 0 이상이어야 합니다')
    }
    if (contract.parties.length === 0) {
      throw new Error('parties는 1명 이상이어야 합니다')
    }
    this.contracts.set(contract.contractId, contract)
    this.appendAudit('contract.register', this.mask(contract.contractId), {
      partyCount: contract.parties.length,
      amountRange: this.amountRange(contract.amount),
    })
  }

  parseContract(contractId: string): ClauseMatch[] {
    const contract = this.contracts.get(contractId)
    if (!contract) throw new Error(`Unknown contract: ${contractId}`)

    const matches: ClauseMatch[] = []
    const lowerText = contract.text.toLowerCase()
    for (const clause of this.requiredClauses.values()) {
      const matchedKeywords = clause.keywords.filter((kw) =>
        lowerText.includes(kw.toLowerCase())
      )
      matches.push({
        clauseId: clause.clauseId,
        category: clause.category,
        matched: matchedKeywords.length === clause.keywords.length,
        matchedKeywords,
      })
    }
    return matches
  }

  detectRisks(contractId: string): RiskFinding[] {
    const contract = this.contracts.get(contractId)
    if (!contract) throw new Error(`Unknown contract: ${contractId}`)

    const findings: RiskFinding[] = []
    const lowerText = contract.text.toLowerCase()
    for (const risk of this.riskKeywords) {
      const kw = risk.keyword.toLowerCase()
      let count = 0
      let idx = 0
      while ((idx = lowerText.indexOf(kw, idx)) !== -1) {
        count++
        idx += kw.length
      }
      if (count > 0) {
        findings.push({
          keyword: risk.keyword,
          weight: risk.weight,
          reason: risk.reason,
          occurrences: count,
        })
      }
    }
    return findings
  }

  validate(contractId: string): ValidationResult {
    const matches = this.parseContract(contractId)
    const risks = this.detectRisks(contractId)

    const requiredTotal = matches.length
    const requiredMatched = matches.filter((m) => m.matched).length
    const missingClauses = matches.filter((m) => !m.matched).map((m) => m.clauseId)

    const riskScore = risks.reduce((sum, r) => sum + r.weight * r.occurrences, 0)

    let status: ValidationStatus = 'INVALID'
    if (requiredMatched === requiredTotal && riskScore === 0) status = 'VALID'
    else if (requiredMatched === requiredTotal && riskScore > 0 && riskScore < 50) status = 'WARN'
    else if (requiredMatched < requiredTotal) status = 'INVALID'
    else status = 'INVALID'

    this.appendAudit('contract.validate', this.mask(contractId), {
      status,
      requiredMatched,
      requiredTotal,
      riskScore,
    })

    return {
      contractId,
      status,
      requiredTotal,
      requiredMatched,
      riskScore,
      risks,
      missingClauses,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private amountRange(amount: number): string {
    if (amount < 1_000_000) return '<100만'
    if (amount < 10_000_000) return '<1000만'
    if (amount < 100_000_000) return '<1억'
    return '>=1억'
  }

  private appendAudit(action: string, contractIdMasked: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      contractIdMasked,
      detail,
    })
  }
}
