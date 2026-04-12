/**
 * ESG Measurement AI — SVC-AI-ADV-R163 (트랙 B 4차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R163/SVC-AI-ADV-R163.design.md
 * Plan SC: FR-R163.1 ~ FR-R163.5
 *
 * 공공기관 ESG(환경/사회/거버넌스) 지표 측정 + GRI/K-ESG 기반 보고서 생성.
 * N2SF N-05: C/S 등급 차단. CSAP D-06: 감사 로그.
 */

// Design Ref: §타입 정의

export type DataGrade = 'C' | 'S' | 'O'
export type EsgStandard = 'GRI' | 'SASB' | 'TCFD' | 'K-ESG'
export type EsgCategory = 'E' | 'S' | 'G'

export interface EsgIndicator {
  code: string
  name: string
  category: EsgCategory
  value?: number | string
  unit?: string
  standard: EsgStandard
}

export interface EsgMeasurementResult {
  period: string
  standard: EsgStandard
  indicators: EsgIndicator[]
  coverage: number
  eScore: number   // 환경 충족률 0~1
  sScore: number   // 사회 충족률 0~1
  gScore: number   // 거버넌스 충족률 0~1
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  issues: string[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class EsgMeasurementAi {
  private readonly templates = new Map<EsgStandard, EsgIndicator[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R163.1 — N2SF N-05 차단
  registerTemplate(standard: EsgStandard, indicators: EsgIndicator[], grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터 ESG 템플릿 등록 금지 (N2SF N-05)`)
    }
    this.templates.set(standard, indicators.map((i) => ({ ...i })))
    this.appendAudit('template.register', { standard, count: indicators.length })
  }

  // Plan SC: FR-R163.2 — 지표 데이터 수집
  collectIndicators(standard: EsgStandard, dataSource: Map<string, number | string>): EsgIndicator[] {
    const tmpl = this.templates.get(standard) ?? []
    return tmpl.map((i) => ({ ...i, value: dataSource.get(i.code) }))
  }

  // Plan SC: FR-R163.3 — Design Ref: §알고리즘 점수 산정
  measure(standard: EsgStandard, period: string, dataSource: Map<string, number | string>): EsgMeasurementResult {
    const collected = this.collectIndicators(standard, dataSource)
    const total = collected.length
    const filled = collected.filter((i) => i.value !== undefined && i.value !== '').length
    const coverage = total === 0 ? 0 : filled / total

    const calcScore = (cat: EsgCategory) => {
      const catItems = collected.filter((i) => i.category === cat)
      if (catItems.length === 0) return 0
      const done = catItems.filter((i) => i.value !== undefined && i.value !== '').length
      return done / catItems.length
    }

    const eScore = calcScore('E')
    const sScore = calcScore('S')
    const gScore = calcScore('G')
    const overall = (eScore + sScore + gScore) / 3

    let overallGrade: EsgMeasurementResult['overallGrade']
    if (overall >= 0.9) overallGrade = 'A'
    else if (overall >= 0.75) overallGrade = 'B'
    else if (overall >= 0.6) overallGrade = 'C'
    else if (overall >= 0.4) overallGrade = 'D'
    else overallGrade = 'F'

    const issues: string[] = []
    if (coverage < 0.8) issues.push(`커버리지 부족: ${(coverage * 100).toFixed(1)}%`)
    const missing = collected.filter((i) => i.value === undefined).map((i) => i.code)
    if (missing.length > 0) issues.push(`누락 지표: ${missing.slice(0, 5).join(', ')}`)

    this.appendAudit('esg.measure', { standard, period, coverage, overallGrade })
    return { period, standard, indicators: collected, coverage: Math.round(coverage * 1000) / 1000, eScore, sScore, gScore, overallGrade, issues }
  }

  // Plan SC: FR-R163.4 — 표준 목록 조회
  listStandards(): EsgStandard[] {
    return [...this.templates.keys()]
  }

  // Plan SC: FR-R163.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
