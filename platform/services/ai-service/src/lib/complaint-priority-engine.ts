/**
 * 공공 민원 우선순위 결정 AI — SVC-AI-ADV-R126
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R126/SVC-AI-ADV-R126.design.md
 * Plan SC: FR-R126.1 ~ FR-R126.6
 *
 * 민원 긴급도/중요도/복잡도 자동 평가 → 처리 우선순위 결정.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard + PII 마스킹.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export type ComplaintCategory =
  | '생활불편'
  | '교통'
  | '환경'
  | '복지'
  | '안전'
  | '행정처리'
  | '기타'

export interface Complaint {
  id: string
  title: string
  content: string
  category: ComplaintCategory
  submittedAt: string
  grade: DataGrade
  citizenId?: string  // PII — masked before processing
}

export interface PriorityScore {
  complaintId: string
  urgency: number      // 0~100: 처리 기한·안전 위협
  importance: number   // 0~100: 영향 범위·공익성
  complexity: number   // 0~100: 처리 난이도
  totalScore: number   // weighted: urgency*0.4 + importance*0.4 + complexity*0.2
  priority: 'P1' | 'P2' | 'P3' | 'P4'
  estimatedDays: number
  reasoning: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

// Plan SC: FR-R126.2 — keyword-based urgency signals
const URGENCY_KEYWORDS = ['긴급', '즉시', '위험', '사고', '응급', '생명', '침수', '화재', '붕괴']
const IMPORTANCE_KEYWORDS = ['다수', '주민', '전체', '공공', '법적', '의무', '민원인']
const COMPLEXITY_KEYWORDS = ['다부처', '협의', '법령', '예산', '설계', '공사', '시공']

function keywordScore(text: string, keywords: string[]): number {
  const lower = text.toLowerCase()
  const hits = keywords.filter(k => lower.includes(k)).length
  return Math.min(100, hits * 20)
}

// Plan SC: FR-R126.3 — PII masking before processing
function maskPii(text: string): string {
  return text
    .replace(/\d{6}-\d{7}/g, '[RRN]')
    .replace(/01[016789]-\d{3,4}-\d{4}/g, '[PHONE]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/\d{2,3}-\d{3,4}-\d{4}/g, '[PHONE]')
}

export class ComplaintPriorityEngine {
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog
  }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R126.4 — priority from score
  private classifyPriority(score: number): PriorityScore['priority'] {
    if (score >= 75) return 'P1'
    if (score >= 50) return 'P2'
    if (score >= 25) return 'P3'
    return 'P4'
  }

  private estimateDays(priority: PriorityScore['priority']): number {
    return { P1: 1, P2: 3, P3: 7, P4: 14 }[priority]
  }

  // Plan SC: FR-R126.1, FR-R126.5
  evaluate(complaint: Complaint): PriorityScore {
    if (complaint.grade === DataGrade.C || complaint.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${complaint.grade}등급 민원 처리 금지 (N2SF N-05)`)
    }

    const maskedContent = maskPii(complaint.content)
    const maskedTitle = maskPii(complaint.title)
    const text = `${maskedTitle} ${maskedContent}`

    // Plan SC: FR-R126.2 — category-based base scores
    const categoryBase: Record<ComplaintCategory, { urgency: number; importance: number }> = {
      '안전': { urgency: 60, importance: 60 },
      '환경': { urgency: 30, importance: 50 },
      '교통': { urgency: 40, importance: 40 },
      '복지': { urgency: 30, importance: 50 },
      '생활불편': { urgency: 20, importance: 30 },
      '행정처리': { urgency: 20, importance: 40 },
      '기타': { urgency: 10, importance: 20 },
    }

    const base = categoryBase[complaint.category]
    const urgency = Math.min(100, base.urgency + keywordScore(text, URGENCY_KEYWORDS))
    const importance = Math.min(100, base.importance + keywordScore(text, IMPORTANCE_KEYWORDS))
    const complexity = Math.min(100, 20 + keywordScore(text, COMPLEXITY_KEYWORDS))
    const totalScore = Math.round(urgency * 0.4 + importance * 0.4 + complexity * 0.2)
    const priority = this.classifyPriority(totalScore)

    const reasoning = `카테고리=${complaint.category}, 긴급도=${urgency}, 중요도=${importance}, 복잡도=${complexity}`

    this.audit('evaluate', { id: complaint.id, priority, totalScore })
    return {
      complaintId: complaint.id,
      urgency,
      importance,
      complexity,
      totalScore,
      priority,
      estimatedDays: this.estimateDays(priority),
      reasoning,
    }
  }

  // Plan SC: FR-R126.6 — batch evaluation with ranking
  evaluateBatch(complaints: Complaint[]): PriorityScore[] {
    const scores = complaints.map(c => this.evaluate(c))
    scores.sort((a, b) => b.totalScore - a.totalScore)
    this.audit('evaluateBatch', { count: complaints.length })
    return scores
  }
}
