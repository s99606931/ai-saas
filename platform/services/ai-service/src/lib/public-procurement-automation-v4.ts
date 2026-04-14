// Design Ref: SVC-AI-ADV-R621 — AI기반 공공기관 구매 자동화 v3 (impl v4)
// Plan SC: FR-R621.1~5
import { createHash } from 'crypto'

interface ProcurementRequest {
  requestId: string
  amount: number
  category: string
  urgency: 'LOW' | 'MEDIUM' | 'HIGH'
  requesterId: string
  vendorCount: number
}

interface AuditEntry {
  timestamp: string
  action: string
  actor?: string
  details?: Record<string, unknown>
}

type ProcurementType = 'DIRECT' | 'LIMITED_BID' | 'OPEN_BID' | 'EMERGENCY'
type Decision = 'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'REJECT'

interface Result {
  requestId: string
  procurementType: ProcurementType
  decision: Decision
  reason: string
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

export class PublicProcurementAutomationV4 {
  private auditLog: AuditEntry[] = []

  classify(req: ProcurementRequest, dataGrade?: 'C' | 'S' | 'O'): Result {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    let type: ProcurementType
    if (req.urgency === 'HIGH') {
      type = 'EMERGENCY'
    } else if (req.amount > 50_000_000) {
      type = 'OPEN_BID'
    } else if (req.amount > 10_000_000) {
      type = 'LIMITED_BID'
    } else {
      type = 'DIRECT'
    }

    let decision: Decision
    let reason: string
    if (type === 'EMERGENCY') {
      decision = 'MANUAL_REVIEW'
      reason = '긴급 구매는 수동 검토 필요'
    } else if (type === 'DIRECT' && req.vendorCount >= 1) {
      decision = 'AUTO_APPROVE'
      reason = '소액 직접 구매, 자동 승인'
    } else if (type === 'LIMITED_BID' && req.vendorCount >= 3) {
      decision = 'AUTO_APPROVE'
      reason = '제한 경쟁 입찰 3인 이상, 자동 승인'
    } else if (type === 'OPEN_BID' && req.vendorCount >= 5) {
      decision = 'MANUAL_REVIEW'
      reason = '공개 입찰은 필수 수동 검토'
    } else {
      decision = 'REJECT'
      reason = '입찰 참여 벤더 수 부족'
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'CLASSIFY_PROCUREMENT',
      actor: maskPII(req.requesterId),
      details: { requestId: req.requestId, amount: req.amount, procurementType: type, decision },
    })

    return { requestId: req.requestId, procurementType: type, decision, reason }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
