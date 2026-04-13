// Design Ref: §R394 — AI기반 지능형 로그 집계 분석
// Plan SC: SVC-AI-ADV-R394-SC01

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
export type DataGrade = 'C' | 'S' | 'O'

export interface LogEntry {
  logId: string
  serviceId: string
  level: LogLevel
  message: string
  timestamp: number
  grade: DataGrade
  metadata?: Record<string, unknown>
}

export interface LogPattern {
  pattern: string
  count: number
  firstSeen: number
  lastSeen: number
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface AggregationReport {
  serviceId: string
  totalLogs: number
  errorRate: number        // 0..1
  fatalCount: number
  topPatterns: LogPattern[]
  anomalyDetected: boolean
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4,
}

export class IntelligentLogAggregatorAI {
  private logs = new Map<string, LogEntry[]>()
  private auditLog: AuditEntry[] = []

  ingest(entry: LogEntry): void {
    // N2SF C/S 등급 차단
    if (entry.grade === 'C' || entry.grade === 'S') {
      throw new Error(`BLOCKED: ${entry.grade}등급 로그는 AI 분석 금지 (N2SF N-05)`)
    }
    const list = this.logs.get(entry.serviceId) ?? []
    list.push(entry)
    this.logs.set(entry.serviceId, list)
  }

  aggregate(serviceId: string): AggregationReport {
    const entries = this.logs.get(serviceId) ?? []
    this.appendAudit('log.aggregate', serviceId, { count: entries.length })

    if (entries.length === 0) {
      return {
        serviceId, totalLogs: 0, errorRate: 0, fatalCount: 0,
        topPatterns: [], anomalyDetected: false, recommendations: [],
      }
    }

    const errorCount = entries.filter((e) => LEVEL_SEVERITY[e.level] >= LEVEL_SEVERITY['ERROR']).length
    const fatalCount = entries.filter((e) => e.level === 'FATAL').length
    const errorRate = errorCount / entries.length

    // 패턴 집계 (메시지 단어 첫 5개로 패턴 키 생성)
    const patternMap = new Map<string, { count: number; firstSeen: number; lastSeen: number; level: LogLevel }>()
    for (const entry of entries) {
      const key = entry.message.split(/\s+/).slice(0, 5).join(' ')
      const existing = patternMap.get(key)
      if (existing) {
        existing.count++
        existing.lastSeen = Math.max(existing.lastSeen, entry.timestamp)
        if (LEVEL_SEVERITY[entry.level] > LEVEL_SEVERITY[existing.level]) {
          existing.level = entry.level
        }
      } else {
        patternMap.set(key, { count: 1, firstSeen: entry.timestamp, lastSeen: entry.timestamp, level: entry.level })
      }
    }

    const topPatterns: LogPattern[] = Array.from(patternMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([pattern, info]) => ({
        pattern,
        count: info.count,
        firstSeen: info.firstSeen,
        lastSeen: info.lastSeen,
        severity: LEVEL_SEVERITY[info.level] >= 4 ? 'CRITICAL'
          : LEVEL_SEVERITY[info.level] >= 3 ? 'HIGH'
          : LEVEL_SEVERITY[info.level] >= 2 ? 'MEDIUM'
          : 'LOW',
      }))

    // 이상 탐지: 에러율 20% 초과 또는 FATAL 존재
    const anomalyDetected = errorRate >= 0.2 || fatalCount > 0

    const recommendations: string[] = []
    if (fatalCount > 0) recommendations.push(`FATAL 로그 ${fatalCount}건 — 즉시 조사 필요`)
    if (errorRate >= 0.2) recommendations.push(`에러율 ${(errorRate * 100).toFixed(0)}% 높음 — 에러 근본 원인 분석 권장`)
    if (topPatterns.some((p) => p.severity === 'CRITICAL')) recommendations.push('CRITICAL 패턴 탐지 — 보안 팀 에스컬레이션 검토')

    return { serviceId, totalLogs: entries.length, errorRate, fatalCount, topPatterns, anomalyDetected, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
