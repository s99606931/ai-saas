/**
 * Public Complaint Classifier — SVC-AI-ADV-R109 (트랙 B)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R109-complaint.design.md
 * Plan SC: FR-R109-C.1 ~ FR-R109-C.5
 *
 * 공공 민원 텍스트 자동 분류 + 담당 부서 배분 + PII 마스킹.
 * N2SF O등급 공개 민원만 처리. 외부 API 없음.
 */

// Design Ref: §2 — 타입 정의

export type DataGrade = 'C' | 'S' | 'O'
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface ComplaintCategory {
  categoryId: string
  name: string
  keywords: string[]
  defaultPriority: Priority
}

export interface Department {
  departmentId: string
  name: string
  categories: string[]
}

export interface ClassificationResult {
  categoryId: string | null
  categoryName: string | null
  score: number
  priority: Priority
  maskedText: string
  unclassified: boolean
}

export interface RoutingResult {
  departmentId: string | null
  departmentName: string | null
  classification: ClassificationResult
}

export interface AuditEntry {
  timestamp: string
  action: string
  categoryId: string | null
  departmentId: string | null
  grade: DataGrade
}

// Design Ref: §3.2 PII 마스킹 패턴
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\d{6}-[1-4]\d{6}/g, replacement: '######-#######' },
  { pattern: /01[016789]-\d{3,4}-\d{4}/g, replacement: '010-****-####' },
  { pattern: /[\w.+-]+@[\w-]+\.[\w.]+/g, replacement: '****@***' },
]

export class PublicComplaintClassifier {
  private readonly categories = new Map<string, ComplaintCategory>()
  private readonly departments = new Map<string, Department>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R109-C.1
  registerCategory(category: ComplaintCategory): void {
    this.categories.set(category.categoryId, { ...category, keywords: [...category.keywords] })
  }

  // Plan SC: FR-R109-C.2
  registerDepartment(department: Department): void {
    this.departments.set(department.departmentId, {
      ...department,
      categories: [...department.categories],
    })
  }

  // Plan SC: FR-R109-C.3 — Design Ref: §3.1 분류, §3.2 PII 마스킹, §3.3 N2SF guard
  classify(complaintText: string, dataGrade: DataGrade = 'O'): ClassificationResult {
    // N2SF N-05: C/S 등급 차단
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(
        `BLOCKED: ${dataGrade}등급 데이터는 분류 처리 금지 (N2SF N-05)`,
      )
    }

    const maskedText = this.maskPii(complaintText)
    const lower = maskedText.toLowerCase()

    let bestCategoryId: string | null = null
    let bestScore = 0
    let bestCategory: ComplaintCategory | null = null

    for (const category of this.categories.values()) {
      let matchCount = 0
      for (const keyword of category.keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          matchCount++
        }
      }
      const score =
        category.keywords.length > 0 ? matchCount / category.keywords.length : 0
      if (score > bestScore) {
        bestScore = score
        bestCategoryId = category.categoryId
        bestCategory = category
      }
    }

    const unclassified = bestScore === 0

    const result: ClassificationResult = {
      categoryId: unclassified ? null : bestCategoryId,
      categoryName: unclassified ? null : (bestCategory?.name ?? null),
      score: bestScore,
      priority: bestCategory?.defaultPriority ?? 'MEDIUM',
      maskedText,
      unclassified,
    }

    this.appendAudit('complaint.classify', result.categoryId, null, dataGrade)
    return result
  }

  // Plan SC: FR-R109-C.4
  route(classification: ClassificationResult): RoutingResult {
    if (classification.unclassified || classification.categoryId === null) {
      this.appendAudit('complaint.route', null, null, 'O')
      return { departmentId: null, departmentName: null, classification }
    }

    for (const dept of this.departments.values()) {
      if (dept.categories.includes(classification.categoryId)) {
        this.appendAudit('complaint.route', classification.categoryId, dept.departmentId, 'O')
        return {
          departmentId: dept.departmentId,
          departmentName: dept.name,
          classification,
        }
      }
    }

    this.appendAudit('complaint.route', classification.categoryId, null, 'O')
    return { departmentId: null, departmentName: null, classification }
  }

  // Plan SC: FR-R109-C.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // Design Ref: §3.2 PII 마스킹
  private maskPii(text: string): string {
    let result = text
    for (const { pattern, replacement } of PII_PATTERNS) {
      result = result.replace(pattern, replacement)
    }
    return result
  }

  private appendAudit(
    action: string,
    categoryId: string | null,
    departmentId: string | null,
    grade: DataGrade,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      categoryId,
      departmentId,
      grade,
    })
  }
}
