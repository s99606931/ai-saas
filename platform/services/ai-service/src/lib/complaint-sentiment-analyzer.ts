/**
 * Complaint Sentiment Analyzer — SVC-AI-ADV-R167 (트랙 B 4차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R167/SVC-AI-ADV-R167.design.md
 * Plan SC: FR-R167.1 ~ FR-R167.5
 *
 * 공공 민원 텍스트 감정 분류 + PII 마스킹 (N2SF N-05).
 * CSAP D-12: PII 입력 검증 + 마스킹.
 */

// Design Ref: §타입 정의

export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'URGENT'
export type DataGrade = 'C' | 'S' | 'O'

export interface ComplaintAnalysis {
  complaintId: string
  sentiment: Sentiment
  score: number
  keywords: string[]
  maskedText: string
}

export interface DepartmentSentimentReport {
  department: string
  totalComplaints: number
  sentimentBreakdown: Record<Sentiment, number>
  avgScore: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  complaintId: string
  detail: Record<string, unknown>
}

// Design Ref: §알고리즘 — 감정 키워드
const URGENT_KEYWORDS = ['긴급', '즉시', '위험', '사고', '생명', '화재', '재난', '응급']
const NEGATIVE_KEYWORDS = ['불만', '문제', '오류', '민원', '항의', '불편', '실망', '부당', '잘못']
const POSITIVE_KEYWORDS = ['감사', '만족', '좋음', '칭찬', '우수', '훌륭', '최고', '친절']

// PII 마스킹 패턴
const PII_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /\d{6}-\d{7}/g, replacement: '######-#######' },
  { regex: /01[016-9]-\d{3,4}-\d{4}/g, replacement: '010-****-####' },
  { regex: /[\w.+\-]+@[\w\-]+\.\w+/g, replacement: '****@***' },
]

function maskPii(text: string): string {
  let result = text
  for (const { regex, replacement } of PII_PATTERNS) {
    result = result.replace(regex, replacement)
  }
  return result
}

export class ComplaintSentimentAnalyzer {
  private readonly departmentData = new Map<string, ComplaintAnalysis[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R167.1 + FR-R167.2 — N2SF N-05 + PII 마스킹
  analyzeComplaint(id: string, text: string, department: string, grade: DataGrade = 'O'): ComplaintAnalysis {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터 분석 금지 (N2SF N-05)`)
    }

    const maskedText = maskPii(text)
    const tokens = maskedText.split(/[\s,.:;!?()\[\]{}"'""''·\-\/\\]+/).filter((t) => t.length >= 2)

    const urgentCount = tokens.filter((t) => URGENT_KEYWORDS.includes(t)).length
    const negCount = tokens.filter((t) => NEGATIVE_KEYWORDS.includes(t)).length
    const posCount = tokens.filter((t) => POSITIVE_KEYWORDS.includes(t)).length

    let sentiment: Sentiment
    if (urgentCount > 0) sentiment = 'URGENT'
    else if (negCount > posCount) sentiment = 'NEGATIVE'
    else if (posCount > 0) sentiment = 'POSITIVE'
    else sentiment = 'NEUTRAL'

    const matchedCount = urgentCount + negCount + posCount
    const score = tokens.length === 0 ? 0 : Math.min(1, matchedCount / tokens.length)

    const matchedKeywords = [
      ...tokens.filter((t) => URGENT_KEYWORDS.includes(t)),
      ...tokens.filter((t) => NEGATIVE_KEYWORDS.includes(t)),
      ...tokens.filter((t) => POSITIVE_KEYWORDS.includes(t)),
    ].filter((k, i, arr) => arr.indexOf(k) === i).slice(0, 5)

    const analysis: ComplaintAnalysis = { complaintId: id, sentiment, score: Math.round(score * 100) / 100, keywords: matchedKeywords, maskedText }

    if (!this.departmentData.has(department)) {
      this.departmentData.set(department, [])
    }
    this.departmentData.get(department)!.push(analysis)
    this.appendAudit('complaint.analyze', id, { department, sentiment })
    return analysis
  }

  // Plan SC: FR-R167.4
  getDepartmentReport(department: string): DepartmentSentimentReport {
    const analyses = this.departmentData.get(department) ?? []
    const breakdown: Record<Sentiment, number> = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, URGENT: 0 }
    for (const a of analyses) breakdown[a.sentiment]++
    const avgScore = analyses.length === 0 ? 0 : analyses.reduce((s, a) => s + a.score, 0) / analyses.length
    return {
      department,
      totalComplaints: analyses.length,
      sentimentBreakdown: breakdown,
      avgScore: Math.round(avgScore * 100) / 100,
    }
  }

  // Plan SC: FR-R167.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, complaintId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, complaintId, detail })
  }
}
