// SVC-AI-ADV-R47: 동적 보안 스캐너 오케스트레이터
// Design Ref: §흐름, §모듈
// Plan SC: FR-R47.2, FR-R47.3

import {
  APIVulnerabilityDetector,
  type APIRequestRecord,
  type VulnerabilityFinding,
  type VulnSeverity,
} from './api-vulnerability-detector'

export interface ScannerOptions {
  detector?: APIVulnerabilityDetector
  auditSink?: (event: Record<string, unknown>) => Promise<void> | void
  alertSink?: (finding: VulnerabilityFinding, request: APIRequestRecord) => Promise<void> | void
  rateLimitWindowMs?: number
  rateLimitThreshold?: number
  authFailureWindowMs?: number
  authFailureThreshold?: number
}

export interface ScanResult {
  requestId: string
  findings: VulnerabilityFinding[]
  blocked: boolean
  highestSeverity: VulnSeverity
}

export interface ScannerStats {
  totalRequests: number
  totalFindings: number
  byCategory: Record<string, number>
  bySeverity: Record<string, number>
  blockedCount: number
  startedAt: Date
}

interface RequestBucket {
  ip: string
  count: number
  windowStart: number
  authFailures: number
}

/**
 * 동적 API 보안 스캐너.
 * 런타임 요청 스트림을 모니터링하고 취약점 탐지 + 알림 + 감사 기록.
 */
export class DynamicSecurityScanner {
  private readonly detector: APIVulnerabilityDetector
  private readonly auditSink?: ScannerOptions['auditSink']
  private readonly alertSink?: ScannerOptions['alertSink']
  private readonly rateLimitWindowMs: number
  private readonly rateLimitThreshold: number
  // NOTE: 미사용. 이유: 인증 실패 윈도우 추적은 향후 FR-SEC.AUTH 구현 시 사용 예정.
  // @ts-expect-error TS6133 — 향후 사용 예정 필드 보존
  private readonly authFailureWindowMs: number
  private readonly authFailureThreshold: number
  private readonly buckets: Map<string, RequestBucket> = new Map()
  private readonly stats: ScannerStats = {
    totalRequests: 0,
    totalFindings: 0,
    byCategory: {},
    bySeverity: {},
    blockedCount: 0,
    startedAt: new Date(),
  }

  constructor(options: ScannerOptions = {}) {
    this.detector = options.detector ?? new APIVulnerabilityDetector()
    this.auditSink = options.auditSink
    this.alertSink = options.alertSink
    this.rateLimitWindowMs = options.rateLimitWindowMs ?? 60_000
    this.rateLimitThreshold = options.rateLimitThreshold ?? 300
    this.authFailureWindowMs = options.authFailureWindowMs ?? 60_000
    this.authFailureThreshold = options.authFailureThreshold ?? 5
  }

  /**
   * 요청 스캔.
   * @returns 차단 여부 + 발견 사항
   */
  async scan(request: APIRequestRecord): Promise<ScanResult> {
    this.stats.totalRequests += 1

    // 1) 패턴 기반 탐지
    const findings = this.detector.detect(request)

    // 2) 속도 기반 탐지 (rate limit evasion, auth bypass 반복)
    const rateFindings = this.checkRateAndAuth(request)
    findings.push(...rateFindings)

    // 3) 통계 갱신
    this.stats.totalFindings += findings.length
    for (const f of findings) {
      this.stats.byCategory[f.category] = (this.stats.byCategory[f.category] ?? 0) + 1
      this.stats.bySeverity[f.severity] = (this.stats.bySeverity[f.severity] ?? 0) + 1
    }

    const highestSeverity = this.highestSeverity(findings)
    const blocked = highestSeverity === 'critical' || highestSeverity === 'high'

    if (blocked) {
      this.stats.blockedCount += 1
    }

    // 4) 감사 로그
    if (this.auditSink && findings.length > 0) {
      await this.auditSink({
        ts: new Date().toISOString(),
        action: 'SECURITY_SCAN',
        requestId: request.id,
        ip: request.ip,
        path: request.path,
        findings: findings.map((f) => ({
          category: f.category,
          severity: f.severity,
          owaspId: f.owaspId,
          csap: f.csapControl,
        })),
        blocked,
      })
    }

    // 5) 알림 (high/critical)
    if (this.alertSink) {
      for (const f of findings) {
        if (f.severity === 'critical' || f.severity === 'high') {
          await this.alertSink(f, request)
        }
      }
    }

    return {
      requestId: request.id,
      findings,
      blocked,
      highestSeverity,
    }
  }

  /**
   * 현재 통계.
   */
  getStats(): ScannerStats {
    return {
      ...this.stats,
      byCategory: { ...this.stats.byCategory },
      bySeverity: { ...this.stats.bySeverity },
    }
  }

  /**
   * 버킷 정리 (주기적 호출 권장).
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart > this.rateLimitWindowMs * 2) {
        this.buckets.delete(key)
      }
    }
  }

  private checkRateAndAuth(request: APIRequestRecord): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = []
    const now = request.timestamp.getTime()
    const key = request.ip

    let bucket = this.buckets.get(key)
    if (!bucket || now - bucket.windowStart > this.rateLimitWindowMs) {
      bucket = { ip: key, count: 0, windowStart: now, authFailures: 0 }
      this.buckets.set(key, bucket)
    }

    bucket.count += 1
    if (request.statusCode === 401 || request.statusCode === 403) {
      bucket.authFailures += 1
    }

    if (bucket.count > this.rateLimitThreshold) {
      findings.push({
        requestId: request.id,
        category: 'RateLimitEvasion',
        severity: 'high',
        matched: `${bucket.count} requests in ${this.rateLimitWindowMs}ms`,
        location: 'path',
        owaspId: 'A04',
        csapControl: 'D-08',
        description: 'Rate limit 임계 초과',
      })
    }

    if (bucket.authFailures > this.authFailureThreshold) {
      findings.push({
        requestId: request.id,
        category: 'AuthBypass',
        severity: 'critical',
        matched: `${bucket.authFailures} auth failures`,
        location: 'status',
        owaspId: 'A07',
        csapControl: 'D-08',
        description: '인증 실패 반복 — 브루트포스 의심',
      })
    }

    return findings
  }

  private highestSeverity(findings: VulnerabilityFinding[]): VulnSeverity {
    const order: VulnSeverity[] = ['info', 'low', 'medium', 'high', 'critical']
    let max: VulnSeverity = 'info'
    for (const f of findings) {
      if (order.indexOf(f.severity) > order.indexOf(max)) {
        max = f.severity
      }
    }
    return max
  }
}

export function createDynamicSecurityScanner(options?: ScannerOptions): DynamicSecurityScanner {
  return new DynamicSecurityScanner(options)
}
