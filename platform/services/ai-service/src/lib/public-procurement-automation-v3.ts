// Design Ref: §설계결정 — AI기반 공공기관 구매 자동화 v3
// Plan SC: FR-R621.1~5

interface ProcurementRequest { requestId: string; itemName: string; quantity: number; estimatedCost: number; status: 'pending' | 'approved' | 'rejected' }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const AUTO_APPROVE_THRESHOLD = 5000000 // 500만원 이하 자동 승인

export class PublicProcurementAutomationV3 {
  private requests = new Map<string, ProcurementRequest>()
  private auditLog: AuditEntry[] = []

  registerRequest(requestId: string, itemName: string, quantity: number, estimatedCost: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const status = estimatedCost <= AUTO_APPROVE_THRESHOLD ? 'approved' : 'pending'
    this.requests.set(requestId, { requestId, itemName, quantity, estimatedCost, status })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_REQUEST', details: { requestId, itemName, estimatedCost, status } })
  }

  approveRequest(requestId: string): void {
    const req = this.requests.get(requestId)
    if (req) this.requests.set(requestId, { ...req, status: 'approved' })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'APPROVE_REQUEST', details: { requestId } })
  }

  getStatus(requestId: string): string {
    return this.requests.get(requestId)?.status ?? 'unknown'
  }

  getPendingRequests(): ProcurementRequest[] {
    return Array.from(this.requests.values()).filter(r => r.status === 'pending')
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
