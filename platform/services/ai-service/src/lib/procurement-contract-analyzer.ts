// SVC-AI-ADV-R43: 공공 조달 계약 분석기
// Design Ref: §모듈, §인터페이스, §위험 조항 카테고리
// Plan SC: FR-R43.1, FR-R43.3
//
// 기존 contract-analyzer.ts와 구분: 본 모듈은 공공 조달 계약 특화 (국가/지방계약법).

import { RegulationComplianceChecker, type ComplianceReport } from './regulation-compliance-checker'

export interface Clause {
  id: string
  text: string
  index: number
  category?: string
}

export type RiskSeverity = 'low' | 'med' | 'high' | 'critical'

export interface RiskFinding {
  clauseId: string
  severity: RiskSeverity
  category: string
  reason: string
  lawRef?: string
  suggestion?: string
}

export interface AnalysisResult {
  totalClauses: number
  clausesByCategory: Record<string, number>
  risks: RiskFinding[]
  riskScore: number  // 0~100
  compliance?: ComplianceReport
  summary: string
}

interface RiskRule {
  category: string
  severity: RiskSeverity
  patterns: RegExp[]
  reason: string
  lawRef?: string
  suggestion?: string
}

/**
 * 공공 조달 계약 특화 분석기.
 * 국가계약법/지방계약법 기준 위험 조항 탐지 + 규정 준수 체크.
 */
export class ProcurementContractAnalyzer {
  private readonly complianceChecker: RegulationComplianceChecker
  private readonly rules: RiskRule[]

  constructor(checker?: RegulationComplianceChecker) {
    this.complianceChecker = checker ?? new RegulationComplianceChecker()
    this.rules = this.defaultRules()
  }

  /**
   * 전체 분석 실행.
   */
  async analyze(contract: string): Promise<AnalysisResult> {
    if (!contract || contract.trim().length === 0) {
      throw new Error('contract text required')
    }

    const clauses = this.extractClauses(contract)
    const clausesByCategory: Record<string, number> = {}
    const risks: RiskFinding[] = []

    for (const clause of clauses) {
      const found = this.scoreRisk(clause)
      risks.push(...found)
      const category = clause.category ?? 'uncategorized'
      clausesByCategory[category] = (clausesByCategory[category] ?? 0) + 1
    }

    const riskScore = this.computeRiskScore(risks)
    const compliance = this.complianceChecker.check(contract, ['CSAP', 'N2SF', 'ISMS-P'])

    const summary = this.buildSummary(clauses.length, risks, compliance, riskScore)

    return {
      totalClauses: clauses.length,
      clausesByCategory,
      risks,
      riskScore,
      compliance,
      summary,
    }
  }

  /**
   * 조항 추출 — 제N조 / 제N항 패턴 + 줄바꿈 블록.
   */
  extractClauses(contract: string): Clause[] {
    const clauses: Clause[] = []
    // 제N조 블록 기준 분할
    const pattern = /제\s*(\d+)\s*조[^\n]*/g
    const matches: Array<{ index: number; text: string }> = []
    let m: RegExpExecArray | null
    while ((m = pattern.exec(contract)) !== null) {
      matches.push({ index: m.index, text: m[0] })
    }

    if (matches.length === 0) {
      // 조항 구조 없으면 단락 단위
      const paragraphs = contract
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
      return paragraphs.map((text, idx) => ({
        id: `clause-${idx + 1}`,
        text,
        index: idx,
        category: this.categorize(text),
      }))
    }

    for (let i = 0; i < matches.length; i += 1) {
      const cur = matches[i]
      const next = matches[i + 1]
      if (!cur) continue
      const end = next ? next.index : contract.length
      const text = contract.substring(cur.index, end).trim()
      clauses.push({
        id: `clause-${i + 1}`,
        text,
        index: i,
        category: this.categorize(text),
      })
    }
    return clauses
  }

  /**
   * 조항 위험도 스코어링.
   */
  scoreRisk(clause: Clause): RiskFinding[] {
    const findings: RiskFinding[] = []
    for (const rule of this.rules) {
      for (const p of rule.patterns) {
        if (p.test(clause.text)) {
          findings.push({
            clauseId: clause.id,
            severity: rule.severity,
            category: rule.category,
            reason: rule.reason,
            lawRef: rule.lawRef,
            suggestion: rule.suggestion,
          })
          break  // 같은 규칙 중복 탐지 방지
        }
      }
    }
    return findings
  }

  private categorize(text: string): string {
    if (/지급|대금|선급|기성/.test(text)) return 'payment'
    if (/보안|암호화|접근/.test(text)) return 'security'
    if (/개인정보|민감정보|파기/.test(text)) return 'privacy'
    if (/지연|지체|위약/.test(text)) return 'penalty'
    if (/분쟁|관할|중재/.test(text)) return 'dispute'
    if (/지적재산|특허|저작권/.test(text)) return 'ip'
    return 'general'
  }

  private computeRiskScore(risks: RiskFinding[]): number {
    const weights: Record<RiskSeverity, number> = {
      low: 1,
      med: 5,
      high: 15,
      critical: 40,
    }
    const total = risks.reduce((sum, r) => sum + weights[r.severity], 0)
    return Math.min(100, total)
  }

  private buildSummary(
    clauseCount: number,
    risks: RiskFinding[],
    compliance: ComplianceReport,
    riskScore: number,
  ): string {
    const critical = risks.filter((r) => r.severity === 'critical').length
    const high = risks.filter((r) => r.severity === 'high').length
    return (
      `총 ${clauseCount}개 조항 분석. ` +
      `위험 조항 ${risks.length}건 (critical ${critical}, high ${high}). ` +
      `위험 점수 ${riskScore}/100. ` +
      `규정 준수 ${(compliance.satisfiedRate * 100).toFixed(1)}%.`
    )
  }

  private defaultRules(): RiskRule[] {
    return [
      {
        category: '부당 특약',
        severity: 'critical',
        patterns: [/일방\s*변경/, /무조건\s*수용/, /이의\s*제기\s*금지/],
        reason: '국가계약법 §5 위반 소지 (공정성 결여)',
        lawRef: '국가계약법 §5',
        suggestion: '상호 협의 조항으로 수정 권장',
      },
      {
        category: '독점/배타성',
        severity: 'high',
        patterns: [/독점적\s*권리/, /배타적\s*사용권/, /타\s*사업자\s*금지/],
        reason: '공공 조달 경쟁성 저해',
        suggestion: '경쟁 공정성 조항 추가',
      },
      {
        category: '지급 조건 모호',
        severity: 'med',
        patterns: [/협의\s*후\s*지급/, /합의\s*시\s*지급/, /추후\s*결정/],
        reason: '지급 시기/금액 모호로 분쟁 위험',
        lawRef: '국가계약법 시행령 §58',
        suggestion: '지급 기일/방식 명시',
      },
      {
        category: '개인정보 처리 누락',
        severity: 'critical',
        patterns: [/개인정보\s*처리/, /위탁\s*처리/],  // 긍정 패턴이지만 절 없으면 missing
        reason: '개인정보 보호법 §26 위탁 조항 필요',
        lawRef: '개인정보 보호법 §26',
        suggestion: '개인정보 처리 위탁 조항 명시',
      },
      {
        category: '보안 요건 누락',
        severity: 'high',
        patterns: [/보안\s*요건/, /CSAP/, /ISMS/],
        reason: '공공 SaaS 보안 요건 명시 필요',
        suggestion: 'CSAP/ISMS-P 체크리스트 첨부',
      },
      {
        category: '지연이자 과도',
        severity: 'med',
        patterns: [/지연이자\s*연\s*\d{2,}\s*%/, /지체상금\s*일\s*\d+%/],
        reason: '지연이자/지체상금 과도',
        lawRef: '국가계약법 시행령 §74',
        suggestion: '법정 한도 이내로 조정',
      },
      {
        category: '분쟁 관할 편향',
        severity: 'med',
        patterns: [/관할\s*법원\s*[일단]방/, /중재\s*포기/],
        reason: '분쟁 해결 조항 편향',
        suggestion: '상호 합의 관할 또는 서울중앙지법',
      },
    ]
  }
}

export function createProcurementAnalyzer(): ProcurementContractAnalyzer {
  return new ProcurementContractAnalyzer()
}
