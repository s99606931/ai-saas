// Plan SC: SVC-AI-ADV-R447
// Design Ref: §최적엔드포인트 — score = weight / latencyMs, 최대 score 선택
type DataGrade = 'O' | 'C' | 'S'

interface Endpoint {
  endpointId: string
  serviceId: string
  latencyMs: number
  weight: number
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

export class ServiceMeshRoutingOptimizerV2 {
  private endpoints = new Map<string, Endpoint>()
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
  }

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  addEndpoint(
    endpointId: string,
    serviceId: string,
    latencyMs: number,
    weight: number,
    dataGrade?: DataGrade,
  ): Endpoint {
    this.checkGrade(dataGrade)
    const endpoint: Endpoint = { endpointId, serviceId, latencyMs, weight }
    this.endpoints.set(endpointId, endpoint)
    this.log('endpoint.add', `endpointId=${endpointId} serviceId=${serviceId} latencyMs=${latencyMs}`)
    return endpoint
  }

  getBestEndpoint(serviceId: string): Endpoint | null {
    const candidates = Array.from(this.endpoints.values()).filter(
      (e) => e.serviceId === serviceId,
    )
    if (candidates.length === 0) return null
    return candidates.reduce((best, curr) => {
      const bestScore = best.weight / best.latencyMs
      const currScore = curr.weight / curr.latencyMs
      return currScore > bestScore ? curr : best
    })
  }

  getServiceEndpoints(serviceId: string): Endpoint[] {
    return Array.from(this.endpoints.values()).filter((e) => e.serviceId === serviceId)
  }

  getHighLatencyEndpoints(thresholdMs: number): Endpoint[] {
    return Array.from(this.endpoints.values()).filter((e) => e.latencyMs > thresholdMs)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
