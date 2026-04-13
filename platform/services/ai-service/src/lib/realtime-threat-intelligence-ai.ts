// Design Ref: §R302 — AI기반 실시간 위협 인텔리전스
// Plan SC: SC-R302

export interface ThreatEvent {
  eventId: string
  sourceIp: string
  eventType: 'LOGIN_FAIL' | 'PORT_SCAN' | 'DATA_EXFIL' | 'MALWARE' | 'PRIVILEGE_ESC' | 'LATERAL_MOVE'
  timestamp: number
  targetResourceId: string
  metadata?: Record<string, string>
}

export interface ThreatIndicator {
  indicatorId: string
  type: 'IP' | 'DOMAIN' | 'HASH'
  value: string
  threatLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
}

export interface ThreatAssessment {
  sourceIp: string
  maskedIp: string
  threatScore: number
  threatLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE'
  detectedPatterns: string[]
  recommendedActions: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

const SEVERITY_SCORE: Record<ThreatEvent['eventType'], number> = {
  PRIVILEGE_ESC: 70,
  MALWARE: 50,
  DATA_EXFIL: 40,
  LATERAL_MOVE: 35,
  PORT_SCAN: 15,
  LOGIN_FAIL: 8,
}

function maskIp(ip: string): string {
  const parts = ip.split('.')
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`
  }
  return ip.substring(0, 4) + '***'
}

export class RealtimeThreatIntelligenceAi {
  private events: ThreatEvent[] = []
  private indicators = new Map<string, ThreatIndicator>()
  private auditLog: AuditEntry[] = []

  registerIndicator(indicator: ThreatIndicator): void {
    this.indicators.set(indicator.value, indicator)
    this.auditLog.push({ action: 'indicator.register', timestamp: new Date().toISOString(), detail: indicator.indicatorId })
  }

  ingestEvent(event: ThreatEvent): void {
    this.events.push(event)
    this.auditLog.push({ action: 'event.ingest', timestamp: new Date().toISOString(), detail: event.eventId })
  }

  assess(sourceIp: string, windowMs = 300_000): ThreatAssessment {
    const now = Date.now()
    const recentEvents = this.events.filter(
      (e) => e.sourceIp === sourceIp && now - e.timestamp <= windowMs
    )

    const detectedPatterns: string[] = []
    let threatScore = 0

    // 이벤트 타입별 점수
    const typeCounts = new Map<ThreatEvent['eventType'], number>()
    for (const event of recentEvents) {
      typeCounts.set(event.eventType, (typeCounts.get(event.eventType) ?? 0) + 1)
    }

    for (const [type, count] of typeCounts) {
      const baseScore = SEVERITY_SCORE[type]
      threatScore += baseScore * Math.min(count, 3)
      if (type === 'LOGIN_FAIL' && count >= 5) {
        detectedPatterns.push('BRUTE_FORCE')
      }
      if (type === 'PORT_SCAN' && count >= 3) {
        detectedPatterns.push('PORT_SCANNING')
      }
      if (type === 'PRIVILEGE_ESC') {
        detectedPatterns.push('PRIVILEGE_ESCALATION')
      }
      if (type === 'DATA_EXFIL') {
        detectedPatterns.push('DATA_EXFILTRATION')
      }
      if (type === 'LATERAL_MOVE') {
        detectedPatterns.push('LATERAL_MOVEMENT')
      }
      if (type === 'MALWARE') {
        detectedPatterns.push('MALWARE_DETECTED')
      }
    }

    // 위협 인디케이터 매칭
    const indicator = this.indicators.get(sourceIp)
    if (indicator) {
      threatScore += indicator.threatLevel === 'CRITICAL' ? 40 : indicator.threatLevel === 'HIGH' ? 25 : 15
      detectedPatterns.push(`KNOWN_THREAT_IP(${indicator.threatLevel})`)
    }

    threatScore = Math.min(threatScore, 100)

    let threatLevel: ThreatAssessment['threatLevel']
    if (threatScore >= 70) threatLevel = 'CRITICAL'
    else if (threatScore >= 50) threatLevel = 'HIGH'
    else if (threatScore >= 30) threatLevel = 'MEDIUM'
    else if (threatScore >= 10) threatLevel = 'LOW'
    else threatLevel = 'SAFE'

    const recommendedActions: string[] = []
    if (threatLevel === 'CRITICAL') {
      recommendedActions.push('즉시 IP 차단 및 보안팀 긴급 알림')
      recommendedActions.push('해당 IP 접근 세션 즉시 종료')
    } else if (threatLevel === 'HIGH') {
      recommendedActions.push('IP 차단 검토 및 모니터링 강화')
    } else if (threatLevel === 'MEDIUM') {
      recommendedActions.push('추가 모니터링 및 로그 보존')
    }

    this.auditLog.push({ action: 'threat.assess', timestamp: new Date().toISOString(), detail: `${maskIp(sourceIp)}:${threatLevel}` })
    return { sourceIp, maskedIp: maskIp(sourceIp), threatScore, threatLevel, detectedPatterns, recommendedActions }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
