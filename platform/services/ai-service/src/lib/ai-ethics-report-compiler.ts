/**
 * AI Ethics Report Compiler — SVC-AI-ADV-R104
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R104.design.md
 * Plan SC: FR-R104.1 ~ FR-R104.5
 *
 * 공공기관 AI 윤리 감사 결과를 행안부 표준 양식으로 컴파일.
 */

export type EthicsPrinciple =
  | 'TRANSPARENCY'
  | 'FAIRNESS'
  | 'ACCOUNTABILITY'
  | 'SAFETY'
  | 'EXPLAINABILITY'
  | 'PRIVACY'

const PRINCIPLE_KR: Record<EthicsPrinciple, string> = {
  TRANSPARENCY: '투명성',
  FAIRNESS: '공정성',
  ACCOUNTABILITY: '책임성',
  SAFETY: '안전성',
  EXPLAINABILITY: '설명가능성',
  PRIVACY: '프라이버시',
}

export interface EthicsPrincipleResult {
  principle: EthicsPrinciple
  passed: boolean
  findings: string[]
  score: number
}

export interface EthicsAuditData {
  organization: string
  systemName: string
  auditDate: string
  auditor: string
  results: EthicsPrincipleResult[]
  recommendations: string[]
}

export class AiEthicsReportCompiler {
  /**
   * FR-R104.1~5: 감사 데이터를 Markdown 보고서로 컴파일.
   */
  compile(data: EthicsAuditData): string {
    const lines: string[] = []
    lines.push('# AI 윤리 감사 보고서')
    lines.push('')
    lines.push(`**기관**: ${data.organization}`)
    lines.push(`**시스템**: ${data.systemName}`)
    lines.push(`**감사일**: ${data.auditDate}`)
    lines.push(`**감사자**: ${data.auditor}`)
    lines.push('')

    const passed = data.results.filter((r) => r.passed).length
    const total = data.results.length
    const avgScore =
      total > 0
        ? data.results.reduce((acc, r) => acc + r.score, 0) / total
        : 0

    lines.push('## 1. 요약')
    lines.push('')
    lines.push(`- 총 ${total}개 원칙 중 **${passed}개 통과**`)
    lines.push(`- 평균 점수: **${avgScore.toFixed(1)}/100**`)
    lines.push('')

    lines.push('## 2. 원칙별 평가')
    lines.push('')
    lines.push('| 원칙 | 점수 | 결과 | 발견사항 |')
    lines.push('|------|------|------|----------|')
    for (const r of data.results) {
      const label = PRINCIPLE_KR[r.principle] ?? r.principle
      const mark = r.passed ? '통과' : '미흡'
      const findings =
        r.findings.length > 0 ? r.findings.join('; ') : '해당 없음'
      lines.push(`| ${label} | ${r.score} | ${mark} | ${findings} |`)
    }
    lines.push('')

    lines.push('## 3. 권고 조치')
    lines.push('')
    if (data.recommendations.length === 0) {
      lines.push('- 권고사항 없음')
    } else {
      for (const rec of data.recommendations) {
        lines.push(`- ${rec}`)
      }
    }
    lines.push('')

    lines.push('## 4. 결재')
    lines.push('')
    lines.push('작성자: _____________ (인)')
    lines.push('')
    lines.push(`생성일: ${new Date().toISOString().slice(0, 10)}`)

    return lines.join('\n')
  }
}
