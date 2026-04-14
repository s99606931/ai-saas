// Design Ref: §품질 점수 공식 — ApiResponseQualityEvaluatorV2
// Plan SC: SVC-AI-ADV-R498

interface ApiEndpoint {
  endpointId: string
  path: string
  method: string
}

interface ResponseRecord {
  statusCode: number
  latencyMs: number
}

interface AuditEntry {
  timestamp: string
  action: string
  endpointId: string
  details?: Record<string, unknown>
}

export class ApiResponseQualityEvaluatorV2 {
  private endpoints = new Map<string, ApiEndpoint>()
  private responses = new Map<string, ResponseRecord[]>()
  private auditLog: AuditEntry[] = []

  registerEndpoint(endpointId: string, path: string, method: string): ApiEndpoint {
    const endpoint: ApiEndpoint = { endpointId, path, method }
    this.endpoints.set(endpointId, endpoint)
    this.responses.set(endpointId, [])
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_ENDPOINT',
      endpointId,
      details: { path, method },
    })
    return endpoint
  }

  recordResponse(endpointId: string, statusCode: number, latencyMs: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.endpoints.has(endpointId)) throw new Error(`엔드포인트를 찾을 수 없습니다: ${endpointId}`)
    this.responses.get(endpointId)!.push({ statusCode, latencyMs })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_RESPONSE',
      endpointId,
      details: { statusCode, latencyMs },
    })
  }

  getQualityScore(endpointId: string): number {
    const records = this.responses.get(endpointId)
    if (!records || records.length === 0) return 100
    const successRate = records.filter((r) => r.statusCode >= 200 && r.statusCode < 300).length / records.length
    const avgLatencyMs = records.reduce((s, r) => s + r.latencyMs, 0) / records.length
    return Math.max(0, successRate * 60 + Math.max(0, (1 - avgLatencyMs / 1000)) * 40)
  }

  getLowQualityEndpoints(): ApiEndpoint[] {
    return Array.from(this.endpoints.values()).filter(
      (ep) => this.getQualityScore(ep.endpointId) < 60
    )
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
