// Design Ref: §R229 — AI기반 API 사용 패턴 분석 v2
// Plan SC: SVC-AI-ADV-R229-SC01

export interface ApiCallRecord {
  apiId: string
  endpoint: string
  method: string
  clientId: string
  responseTimeMs: number
  statusCode: number
  timestamp: number  // epoch ms
}

export interface UsagePattern {
  apiId: string
  endpoint: string
  totalCalls: number
  successRate: number
  avgResponseTimeMs: number
  p95ResponseTimeMs: number
  peakHour: number
  topClients: Array<{ clientId: string; callCount: number }>
  trend: 'GROWING' | 'STABLE' | 'DECLINING'
}

export interface AnomalyReport {
  apiId: string
  anomalies: Array<{ clientId: string; callCount: number; reason: string }>
}

interface AuditEntry {
  timestamp: string
  action: string
  apiId: string
  detail: Record<string, unknown>
}

export class ApiUsagePatternAnalyzerV2 {
  private records = new Map<string, ApiCallRecord[]>()
  private auditLog: AuditEntry[] = []

  ingest(record: ApiCallRecord): void {
    const list = this.records.get(record.apiId) ?? []
    list.push(record)
    this.records.set(record.apiId, list)
  }

  analyze(apiId: string): UsagePattern {
    const records = this.records.get(apiId) ?? []
    this.appendAudit('analyze.start', apiId, { recordCount: records.length })

    if (records.length === 0) {
      return { apiId, endpoint: '', totalCalls: 0, successRate: 0, avgResponseTimeMs: 0, p95ResponseTimeMs: 0, peakHour: 0, topClients: [], trend: 'STABLE' }
    }

    const endpoint = records[0]?.endpoint ?? ''
    const totalCalls = records.length
    const successCount = records.filter((r) => r.statusCode >= 200 && r.statusCode < 400).length
    const successRate = successCount / totalCalls

    const responseTimes = records.map((r) => r.responseTimeMs).sort((a, b) => a - b)
    const avgResponseTimeMs = responseTimes.reduce((s, v) => s + v, 0) / totalCalls
    const p95Index = Math.floor(totalCalls * 0.95)
    const p95ResponseTimeMs = responseTimes[p95Index] ?? responseTimes[responseTimes.length - 1] ?? 0

    // 시간대별 분포 (UTC 시간)
    const hourCounts = new Array(24).fill(0) as number[]
    for (const r of records) {
      const hour = new Date(r.timestamp).getUTCHours()
      hourCounts[hour] = (hourCounts[hour] ?? 0) + 1
    }
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts))

    // 상위 클라이언트
    const clientMap = new Map<string, number>()
    for (const r of records) {
      clientMap.set(r.clientId, (clientMap.get(r.clientId) ?? 0) + 1)
    }
    const topClients = Array.from(clientMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([clientId, callCount]) => ({ clientId, callCount }))

    // 트렌드: 후반 레코드 수가 전반보다 많으면 GROWING
    const half = Math.floor(records.length / 2)
    const firstHalfCount = half
    const secondHalfCount = records.length - half
    const trend: UsagePattern['trend'] =
      secondHalfCount > firstHalfCount ? 'GROWING'
        : secondHalfCount < firstHalfCount ? 'DECLINING'
        : 'STABLE'

    this.appendAudit('analyze.complete', apiId, { totalCalls, successRate, trend })

    return { apiId, endpoint, totalCalls, successRate, avgResponseTimeMs, p95ResponseTimeMs, peakHour, topClients, trend }
  }

  detectAnomalies(apiId: string, thresholdMultiplier = 3): AnomalyReport {
    const records = this.records.get(apiId) ?? []
    const clientMap = new Map<string, number>()
    for (const r of records) {
      clientMap.set(r.clientId, (clientMap.get(r.clientId) ?? 0) + 1)
    }

    const counts = Array.from(clientMap.values())
    const minCount = counts.length > 0 ? Math.min(...counts) : 0
    const anomalies: AnomalyReport['anomalies'] = []

    for (const [clientId, callCount] of clientMap) {
      // 최솟값 대비 threshold배 초과 시 이상 클라이언트로 판단
      if (minCount > 0 && callCount > minCount * thresholdMultiplier) {
        anomalies.push({ clientId, callCount, reason: `최소 ${minCount}건 대비 ${thresholdMultiplier}배 초과` })
      }
    }

    return { apiId, anomalies }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, apiId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, apiId, detail })
  }
}
