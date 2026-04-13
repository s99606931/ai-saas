// Design Ref: §R397 — AI기반 실시간 API 보안 위협 탐지
// Plan SC: SVC-AI-ADV-R397-SC01

export type ThreatType = 'BRUTE_FORCE' | 'SQL_INJECTION' | 'XSS' | 'PATH_TRAVERSAL' | 'RATE_ABUSE' | 'ANOMALOUS_PAYLOAD'
export type ThreatSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ApiRequest {
  requestId: string
  clientIp: string
  endpoint: string
  method: string
  payload: string
  statusCode: number
  timestamp: number
  clientId: string
}

export interface ThreatDetectionResult {
  requestId: string
  blocked: boolean
  threats: Array<{ type: ThreatType; severity: ThreatSeverity; detail: string }>
  riskScore: number  // 0..100
}

interface AuditEntry {
  timestamp: string
  action: string
  clientId: string
  detail: Record<string, unknown>
}

const SQL_PATTERNS = [/(\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bDELETE\b).*(\bFROM\b|\bINTO\b|\bTABLE\b)/i, /('|\").*(--)/, /;\s*(DROP|DELETE|INSERT|UPDATE)/i]
const XSS_PATTERNS = [/<script[\s>]/i, /javascript:/i, /on\w+\s*=/i]
const PATH_PATTERNS = [/\.\.[/\\]/, /%2e%2e[/\\%]/i]

export class RealtimeApiThreatDetector {
  private requestHistory = new Map<string, ApiRequest[]>()  // clientIp → requests
  private auditLog: AuditEntry[] = []

  detect(request: ApiRequest): ThreatDetectionResult {
    const threats: ThreatDetectionResult['threats'] = []
    let riskScore = 0

    // 이력 업데이트
    const history = this.requestHistory.get(request.clientIp) ?? []
    history.push(request)
    this.requestHistory.set(request.clientIp, history)

    const fullText = `${request.endpoint} ${request.payload}`

    // SQL 주입 탐지
    for (const pattern of SQL_PATTERNS) {
      if (pattern.test(fullText)) {
        threats.push({ type: 'SQL_INJECTION', severity: 'CRITICAL', detail: 'SQL 주입 패턴 탐지' })
        riskScore += 40
        break
      }
    }

    // XSS 탐지
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(fullText)) {
        threats.push({ type: 'XSS', severity: 'HIGH', detail: 'XSS 패턴 탐지' })
        riskScore += 25
        break
      }
    }

    // 경로 순회 탐지
    for (const pattern of PATH_PATTERNS) {
      if (pattern.test(fullText)) {
        threats.push({ type: 'PATH_TRAVERSAL', severity: 'HIGH', detail: '경로 순회 패턴 탐지' })
        riskScore += 25
        break
      }
    }

    // 무차별 대입: 최근 1분 내 동일 IP 401 응답 5건 이상
    const recentMs = 60_000
    const now = request.timestamp
    const recentRequests = history.filter((r) => now - r.timestamp <= recentMs)
    const failedCount = recentRequests.filter((r) => r.statusCode === 401).length
    if (failedCount >= 5) {
      threats.push({ type: 'BRUTE_FORCE', severity: 'CRITICAL', detail: `1분 내 인증 실패 ${failedCount}건` })
      riskScore += 35
    }

    // 레이트 남용: 최근 1분 내 동일 IP 100건 이상
    if (recentRequests.length >= 100) {
      threats.push({ type: 'RATE_ABUSE', severity: 'HIGH', detail: `1분 내 ${recentRequests.length}건 요청` })
      riskScore += 20
    }

    riskScore = Math.min(100, riskScore)
    const blocked = threats.some((t) => t.severity === 'CRITICAL') || riskScore >= 60

    this.appendAudit('threat.detect', request.clientId, {
      requestId: request.requestId,
      threatCount: threats.length,
      riskScore,
      blocked,
    })

    return { requestId: request.requestId, blocked, threats, riskScore }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, clientId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, clientId, detail })
  }
}
