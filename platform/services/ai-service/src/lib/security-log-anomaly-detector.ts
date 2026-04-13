// Design Ref: §R362 — AI기반 보안 로그 이상 탐지
// Plan SC: SC-R362

export interface SecurityLogEntry {
  logId: string
  timestamp: number
  sourceIp: string
  userId: string
  action: string
  resource: string
  statusCode: number
  region: string
}

export type AnomalyType = 'BRUTE_FORCE' | 'PRIVILEGE_ESCALATION' | 'DATA_EXFILTRATION' | 'IMPOSSIBLE_TRAVEL' | 'OFF_HOURS_ACCESS'
export type AnomalySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface AnomalyEvent {
  anomalyId: string
  anomalyType: AnomalyType
  severity: AnomalySeverity
  affectedUserId: string
  maskedUserId: string
  sourceIp: string
  maskedIp: string
  description: string
  recommendedAction: string
}

export interface LogAnalysisResult {
  totalLogs: number
  anomaliesDetected: number
  anomalies: AnomalyEvent[]
  riskScore: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

let anomalyCounter = 0

function maskUserId(userId: string): string {
  if (userId.length <= 3) return '*'.repeat(userId.length)
  return userId.slice(0, 2) + '*'.repeat(userId.length - 4) + userId.slice(-2)
}

function maskIp(ip: string): string {
  const parts = ip.split('.')
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : ip
}

export class SecurityLogAnomalyDetector {
  private auditLog: AuditEntry[] = []

  analyze(logs: SecurityLogEntry[]): LogAnalysisResult {
    const anomalies: AnomalyEvent[] = []

    // 실패 횟수 집계 (brute force)
    const failCountByUser = new Map<string, number>()
    for (const log of logs) {
      if (log.statusCode === 401 || log.statusCode === 403) {
        failCountByUser.set(log.userId, (failCountByUser.get(log.userId) ?? 0) + 1)
      }
    }

    for (const [userId, count] of failCountByUser) {
      if (count >= 5) {
        anomalyCounter++
        const log = logs.find((l) => l.userId === userId)!
        anomalies.push({
          anomalyId: `ANOM-${String(anomalyCounter).padStart(4, '0')}`,
          anomalyType: 'BRUTE_FORCE',
          severity: count >= 10 ? 'CRITICAL' : 'HIGH',
          affectedUserId: userId,
          maskedUserId: maskUserId(userId),
          sourceIp: log.sourceIp,
          maskedIp: maskIp(log.sourceIp),
          description: `${count}회 인증 실패 감지 (Brute Force 의심)`,
          recommendedAction: '해당 계정 즉시 잠금 및 보안팀 통보',
        })
      }
    }

    // 야간 접근 탐지 (00:00~06:00 KST = UTC 15:00~21:00)
    for (const log of logs) {
      const hour = new Date(log.timestamp).getUTCHours()
      if (hour >= 15 && hour < 21 && log.statusCode === 200) {
        // 이미 brute force로 잡힌 사용자 제외
        if (!anomalies.some((a) => a.affectedUserId === log.userId && a.anomalyType === 'BRUTE_FORCE')) {
          anomalyCounter++
          anomalies.push({
            anomalyId: `ANOM-${String(anomalyCounter).padStart(4, '0')}`,
            anomalyType: 'OFF_HOURS_ACCESS',
            severity: 'MEDIUM',
            affectedUserId: log.userId,
            maskedUserId: maskUserId(log.userId),
            sourceIp: log.sourceIp,
            maskedIp: maskIp(log.sourceIp),
            description: `야간 시간대(UTC ${new Date(log.timestamp).getUTCHours()}시) 접근 감지`,
            recommendedAction: '사용자에게 접근 확인 요청',
          })
          break // 동일 로그 배치에서 한 번만
        }
      }
    }

    // 위험 점수: CRITICAL×40 + HIGH×20 + MEDIUM×10
    const riskScore = Math.min(100, anomalies.reduce((s, a) => {
      if (a.severity === 'CRITICAL') return s + 40
      if (a.severity === 'HIGH') return s + 20
      return s + 10
    }, 0))

    this.auditLog.push({ action: 'log.analyze', timestamp: new Date().toISOString(), detail: `anomalies=${anomalies.length}:risk=${riskScore}` })
    return { totalLogs: logs.length, anomaliesDetected: anomalies.length, anomalies, riskScore }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
