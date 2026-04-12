/**
 * Complaint Auto Router — SVC-AI-ADV-R191 (트랙 B 5차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R191/SVC-AI-ADV-R191.design.md
 * Plan SC: FR-R191.1 ~ FR-R191.5
 *
 * 민원 자동 분류 + 담당 부서 배분. N2SF N-05.
 */

export type DataGrade = 'C' | 'S' | 'O'
export type ComplaintPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'

export interface ComplaintCategory {
  categoryId: string
  name: string
  keywords: string[]
  department: string
}

export interface Complaint {
  complaintId: string
  title: string
  body: string
  grade?: DataGrade
}

export interface ClassifiedComplaint {
  complaintId: string
  categoryId: string
  department: string
  priority: ComplaintPriority
  confidence: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  complaintId: string
  detail: Record<string, unknown>
}

const URGENT_TERMS = ['긴급', '즉시', '위험', '응급', '사고']

export class ComplaintAutoRouter {
  private readonly categories = new Map<string, ComplaintCategory>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R191.1
  registerCategory(cat: ComplaintCategory): void {
    this.categories.set(cat.categoryId, { ...cat, keywords: [...cat.keywords] })
  }

  // Plan SC: FR-R191.2 + FR-R191.3 + FR-R191.4 — Design Ref: §알고리즘
  classify(complaint: Complaint): ClassifiedComplaint {
    if (complaint.grade === 'C' || complaint.grade === 'S') {
      throw new Error(`BLOCKED: ${complaint.grade}등급 민원 처리 금지 (N2SF N-05)`)
    }

    const text = `${complaint.title} ${complaint.body}`.toLowerCase()

    let bestCategory: ComplaintCategory | null = null
    let bestMatch = 0
    let bestTotal = 1

    for (const cat of this.categories.values()) {
      const matched = cat.keywords.filter((k) => text.includes(k.toLowerCase())).length
      if (matched > bestMatch) {
        bestMatch = matched
        bestTotal = cat.keywords.length
        bestCategory = cat
      }
    }

    const confidence = bestCategory ? Math.min(1, bestMatch / bestTotal) : 0
    const isUrgent = URGENT_TERMS.some((t) => text.includes(t))

    let priority: ComplaintPriority
    if (isUrgent) priority = 'URGENT'
    else if (confidence >= 0.5) priority = 'HIGH'
    else if (confidence >= 0.2) priority = 'NORMAL'
    else priority = 'LOW'

    const result: ClassifiedComplaint = {
      complaintId: complaint.complaintId,
      categoryId: bestCategory?.categoryId ?? 'UNKNOWN',
      department: bestCategory?.department ?? '미분류',
      priority,
      confidence: Math.round(confidence * 10000) / 10000,
    }
    this.appendAudit('complaint.classify', complaint.complaintId, { categoryId: result.categoryId, priority })
    return result
  }

  // Plan SC: FR-R191.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, complaintId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, complaintId, detail })
  }
}
