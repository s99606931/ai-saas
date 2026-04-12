/**
 * AI 기반 API 보안 게이트웨이 v2 — SVC-AI-ADV-R142
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R142/SVC-AI-ADV-R142.plan.md
 * Plan SC: FR-R142.1 ~ FR-R142.7
 *
 * 행동 기반 이상 탐지 + 자동 차단. 기존 ai-gateway.ts 개선.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface ApiRequest {
  requestId: string
  clientId: string
  endpoint: string
  method: string
  timestamp: string
  payloadBytes: number
  grade: DataGrade
}

export interface ClientProfile {
  clientId: string
  avgRps: number            // historical avg requests per second
  avgPayloadBytes: number
  knownEndpoints: string[]  // endpoints this client normally calls
  blocked: boolean
  blockReason?: string
  blockUntil?: string
}

export type AnomalyType =
  | 'rate-spike'
  | 'payload-spike'
  | 'endpoint-anomaly'
  | 'after-hours-access'

export interface AnomalyEvent {
  clientId: string
  requestId: string
  anomalies: AnomalyType[]
  riskScore: number    // 0~100
  decision: 'ALLOW' | 'THROTTLE' | 'BLOCK'
  timestamp: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

export class ApiSecurityGatewayV2 {
  private readonly profiles = new Map<string, ClientProfile>()
  private readonly requestLog = new Map<string, ApiRequest[]>()
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] { return this.auditLog }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R142.1
  registerClient(profile: ClientProfile): void {
    this.profiles.set(profile.clientId, { ...profile })
    this.audit('registerClient', { clientId: profile.clientId })
  }

  // Plan SC: FR-R142.2
  blockClient(clientId: string, reason: string, durationSeconds = 3600): void {
    const profile = this.profiles.get(clientId)
    if (!profile) throw new Error(`unknown client: ${clientId}`)
    profile.blocked = true
    profile.blockReason = reason
    profile.blockUntil = new Date(Date.now() + durationSeconds * 1000).toISOString()
    this.audit('blockClient', { clientId, reason, durationSeconds })
  }

  unblockClient(clientId: string): void {
    const profile = this.profiles.get(clientId)
    if (profile) { profile.blocked = false; profile.blockReason = undefined; profile.blockUntil = undefined }
    this.audit('unblockClient', { clientId })
  }

  // Plan SC: FR-R142.3 — detect anomalies from current request vs profile
  private detectAnomalies(req: ApiRequest, profile: ClientProfile, windowRps: number): AnomalyType[] {
    const anomalies: AnomalyType[] = []

    if (profile.avgRps > 0 && windowRps > profile.avgRps * 5) {
      anomalies.push('rate-spike')
    }
    if (profile.avgPayloadBytes > 0 && req.payloadBytes > profile.avgPayloadBytes * 10) {
      anomalies.push('payload-spike')
    }
    if (profile.knownEndpoints.length > 0 && !profile.knownEndpoints.includes(req.endpoint)) {
      anomalies.push('endpoint-anomaly')
    }
    // after-hours: 22:00 ~ 06:00 KST (UTC+9)
    const hour = (new Date(req.timestamp).getUTCHours() + 9) % 24
    if (hour >= 22 || hour < 6) {
      anomalies.push('after-hours-access')
    }

    return anomalies
  }

  // Plan SC: FR-R142.4
  private riskScore(anomalies: AnomalyType[]): number {
    const weights: Record<AnomalyType, number> = {
      'rate-spike': 40,
      'payload-spike': 30,
      'endpoint-anomaly': 20,
      'after-hours-access': 10,
    }
    return Math.min(100, anomalies.reduce((s, a) => s + weights[a], 0))
  }

  // Plan SC: FR-R142.5
  private decide(score: number, blocked: boolean): AnomalyEvent['decision'] {
    if (blocked) return 'BLOCK'
    if (score >= 70) return 'BLOCK'
    if (score >= 40) return 'THROTTLE'
    return 'ALLOW'
  }

  // Plan SC: FR-R142.6, FR-R142.7
  inspect(req: ApiRequest): AnomalyEvent {
    if (req.grade === DataGrade.C || req.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${req.grade}등급 요청 처리 금지 (N2SF N-05)`)
    }

    // Track requests for rate calculation
    if (!this.requestLog.has(req.clientId)) this.requestLog.set(req.clientId, [])
    const clientReqs = this.requestLog.get(req.clientId)!
    clientReqs.push(req)

    // Calculate RPS over last 10 seconds
    const now = new Date(req.timestamp).getTime()
    const windowReqs = clientReqs.filter(r => now - new Date(r.timestamp).getTime() <= 10_000)
    const windowRps = windowReqs.length / 10

    const profile = this.profiles.get(req.clientId)
    const defaultProfile: ClientProfile = {
      clientId: req.clientId,
      avgRps: 0,
      avgPayloadBytes: 0,
      knownEndpoints: [],
      blocked: false,
    }
    const activeProfile = profile ?? defaultProfile

    const anomalies = this.detectAnomalies(req, activeProfile, windowRps)
    const score = this.riskScore(anomalies)
    const decision = this.decide(score, activeProfile.blocked)

    // Auto-block if BLOCK decision
    if (decision === 'BLOCK' && score >= 70 && profile) {
      profile.blocked = true
      profile.blockReason = `자동 차단: 위험 점수 ${score}`
      profile.blockUntil = new Date(Date.now() + 3600_000).toISOString()
    }

    this.audit('inspect', { clientId: req.clientId, decision, score, anomalies: anomalies.length })
    return {
      clientId: req.clientId,
      requestId: req.requestId,
      anomalies,
      riskScore: score,
      decision,
      timestamp: req.timestamp,
    }
  }
}
