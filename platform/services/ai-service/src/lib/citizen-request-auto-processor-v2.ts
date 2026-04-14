// Design Ref: §상태 흐름 — CitizenRequestAutoProcessorV2
// Plan SC: SVC-AI-ADV-R502

import { createHash } from 'crypto'

type RequestStatus = 'pending' | 'processing' | 'completed' | 'rejected'

interface CitizenRequest {
  requestId: string
  citizenId: string
  requestType: string
  description: string
  status: RequestStatus
}

interface AuditEntry {
  timestamp: string
  action: string
  requestId: string
  maskedCitizenId?: string
  details?: Record<string, unknown>
}

export class CitizenRequestAutoProcessorV2 {
  private requests = new Map<string, CitizenRequest>()
  private auditLog: AuditEntry[] = []

  registerRequest(
    requestId: string,
    citizenId: string,
    requestType: string,
    description: string
  ): CitizenRequest {
    const maskedCitizenId = createHash('sha256').update(citizenId).digest('hex').substring(0, 16)
    const request: CitizenRequest = { requestId, citizenId, requestType, description, status: 'pending' }
    this.requests.set(requestId, request)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_REQUEST',
      requestId,
      maskedCitizenId,
      details: { requestType },
    })
    return request
  }

  updateStatus(requestId: string, status: RequestStatus, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const request = this.requests.get(requestId)
    if (!request) throw new Error(`요청을 찾을 수 없습니다: ${requestId}`)
    request.status = status
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'UPDATE_STATUS',
      requestId,
      details: { status },
    })
  }

  getRequestTypeStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    for (const req of this.requests.values()) {
      stats[req.requestType] = (stats[req.requestType] ?? 0) + 1
    }
    return stats
  }

  getPendingRequests(): CitizenRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.status === 'pending')
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
