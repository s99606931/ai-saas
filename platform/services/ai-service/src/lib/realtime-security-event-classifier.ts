// Design Ref: §R206 — AI기반 실시간 보안 이벤트 분류
// Plan SC: SVC-AI-ADV-R206-SC01
// CSAP D-06: 보안 이벤트 전수 감사 로그

export type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
export type EventCategory = 'AUTH' | 'NETWORK' | 'DATA' | 'SYSTEM' | 'UNKNOWN'

export interface SecurityEvent {
  eventId: string
  source: string
  message: string
  timestamp: string
  rawScore?: number
}

export interface ClassifiedEvent {
  eventId: string
  category: EventCategory
  threatLevel: ThreatLevel
  confidence: number
  mitigationSuggestion: string
  classifiedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  eventId: string
  detail: Record<string, unknown>
}

const CATEGORY_PATTERNS: Array<{ category: EventCategory; keywords: string[] }> = [
  { category: 'AUTH', keywords: ['login', 'password', 'auth', 'credential', '인증', '로그인', '비밀번호'] },
  { category: 'NETWORK', keywords: ['firewall', 'port', 'scan', 'ddos', '방화벽', '포트', '스캔'] },
  { category: 'DATA', keywords: ['exfil', 'leak', 'dump', 'export', '유출', '덤프', '다운로드'] },
  { category: 'SYSTEM', keywords: ['kernel', 'process', 'memory', 'cpu', '프로세스', '메모리'] },
]

const CRITICAL_TERMS = ['exfil', 'leak', 'ransomware', 'breach', '유출', '랜섬', '침해']
const HIGH_TERMS = ['fail', 'block', 'attack', 'intrusion', '실패', '차단', '공격']

export class RealtimeSecurityEventClassifier {
  private auditLog: AuditEntry[] = []

  classify(event: SecurityEvent): ClassifiedEvent {
    this.appendAudit('event.classify', event.eventId, { source: event.source })

    const text = `${event.message} ${event.source}`.toLowerCase()
    const category = this.detectCategory(text)
    const { threatLevel, confidence } = this.assessThreat(text, event.rawScore)
    const mitigationSuggestion = this.buildMitigation(category, threatLevel)

    const result: ClassifiedEvent = {
      eventId: event.eventId,
      category,
      threatLevel,
      confidence,
      mitigationSuggestion,
      classifiedAt: new Date().toISOString(),
    }

    this.appendAudit('event.classified', event.eventId, { category, threatLevel, confidence })
    return result
  }

  private detectCategory(text: string): EventCategory {
    for (const { category, keywords } of CATEGORY_PATTERNS) {
      if (keywords.some((k) => text.includes(k))) return category
    }
    return 'UNKNOWN'
  }

  private assessThreat(text: string, rawScore?: number): { threatLevel: ThreatLevel; confidence: number } {
    if (rawScore !== undefined) {
      const level: ThreatLevel =
        rawScore >= 0.9 ? 'CRITICAL' : rawScore >= 0.7 ? 'HIGH' : rawScore >= 0.4 ? 'MEDIUM' : rawScore >= 0.2 ? 'LOW' : 'INFO'
      return { threatLevel: level, confidence: rawScore }
    }

    let score = 0
    for (const term of CRITICAL_TERMS) {
      if (text.includes(term)) score += 0.3
    }
    for (const term of HIGH_TERMS) {
      if (text.includes(term)) score += 0.15
    }
    const confidence = Math.min(1, score)
    const threatLevel: ThreatLevel =
      confidence >= 0.6 ? 'CRITICAL' : confidence >= 0.4 ? 'HIGH' : confidence >= 0.2 ? 'MEDIUM' : confidence > 0 ? 'LOW' : 'INFO'
    return { threatLevel, confidence }
  }

  private buildMitigation(category: EventCategory, level: ThreatLevel): string {
    if (level === 'CRITICAL') return `${category} 위협 — 즉시 격리 및 인시던트 대응팀 소집 필요`
    if (level === 'HIGH') return `${category} 위협 — 접근 차단 및 로그 분석 즉시 수행`
    if (level === 'MEDIUM') return `${category} 이상 — 모니터링 강화 및 상세 조사 권장`
    return `${category} 이벤트 — 일반 모니터링 유지`
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, eventId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, eventId, detail })
  }
}
