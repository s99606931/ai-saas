// Design Ref: §R238 — AI기반 공공 조달 자동화
// Plan SC: SVC-AI-ADV-R238-SC01

export type ProcurementType = 'GENERAL' | 'LIMITED' | 'SOLE_SOURCE' | 'EMERGENCY'
export type ProcurementStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'

export interface ProcurementRequest {
  requestId: string
  title: string
  department: string
  estimatedAmount: number  // 원
  procurementType: ProcurementType
  urgency: boolean
  vendorCount: number  // 입찰 참여 업체 수
  description: string
}

export interface ProcurementReview {
  requestId: string
  status: ProcurementStatus
  riskLevel: RiskLevel
  riskScore: number
  issues: string[]
  recommendation: string
  requiresCommitteeApproval: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  requestId: string
  detail: Record<string, unknown>
}

const AMOUNT_THRESHOLD_COMMITTEE = 100_000_000  // 1억 원 이상 위원회 심의

export class PublicProcurementAutomationAi {
  private requests = new Map<string, ProcurementRequest>()
  private reviews = new Map<string, ProcurementReview>()
  private auditLog: AuditEntry[] = []

  submitRequest(request: ProcurementRequest): void {
    if (request.estimatedAmount <= 0) throw new Error('추정 금액은 0보다 커야 합니다')
    this.requests.set(request.requestId, request)
    this.appendAudit('request.submit', request.requestId, { department: request.department, amount: request.estimatedAmount })
  }

  review(requestId: string): ProcurementReview {
    const req = this.requests.get(requestId)
    if (!req) throw new Error(`Unknown request: ${requestId}`)

    let riskScore = 0
    const issues: string[] = []

    // 위험 점수 계산
    if (req.vendorCount < 2) { riskScore += 30; issues.push('경쟁 입찰 부족 (1개사 이하)') }
    if (req.vendorCount === 1) { riskScore += 20; issues.push('단독 입찰') }
    if (req.urgency) { riskScore += 20; issues.push('긴급 조달') }
    if (req.estimatedAmount > 500_000_000) { riskScore += 15; issues.push('대규모 계약 (5억 원 초과)') }
    if (req.procurementType === 'SOLE_SOURCE') { riskScore += 25; issues.push('수의계약') }
    if (req.procurementType === 'EMERGENCY') { riskScore += 20; issues.push('긴급 수의계약') }

    const riskLevel: RiskLevel =
      riskScore >= 60 ? 'VERY_HIGH' :
      riskScore >= 40 ? 'HIGH' :
      riskScore >= 20 ? 'MEDIUM' : 'LOW'

    const requiresCommitteeApproval =
      req.estimatedAmount >= AMOUNT_THRESHOLD_COMMITTEE || riskLevel === 'VERY_HIGH' || riskLevel === 'HIGH'

    let status: ProcurementStatus = 'APPROVED'
    if (riskLevel === 'VERY_HIGH') status = 'REVIEW'
    else if (requiresCommitteeApproval) status = 'REVIEW'

    const recommendation =
      riskLevel === 'VERY_HIGH' ? '조달 심의위원회 긴급 검토 필요' :
      riskLevel === 'HIGH' ? '상위 결재 및 위원회 검토 필요' :
      riskLevel === 'MEDIUM' ? '담당 부서장 승인 후 진행 가능' :
      '일반 조달 절차로 진행 가능'

    const review: ProcurementReview = {
      requestId,
      status,
      riskLevel,
      riskScore,
      issues,
      recommendation,
      requiresCommitteeApproval,
    }

    this.reviews.set(requestId, review)
    this.appendAudit('request.review', requestId, { riskLevel, riskScore, status })
    return review
  }

  getReview(requestId: string): ProcurementReview | undefined {
    return this.reviews.get(requestId)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, requestId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, requestId, detail })
  }
}
