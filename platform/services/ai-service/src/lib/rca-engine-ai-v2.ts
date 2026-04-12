// Design Ref: §R204 — AI기반 자동 장애 근본원인 분석 v2
// Plan SC: SVC-AI-ADV-R204-SC01

export type IncidentSeverity = 'P1' | 'P2' | 'P3' | 'P4'
export type RootCauseCategory = 'INFRASTRUCTURE' | 'APPLICATION' | 'DATABASE' | 'NETWORK' | 'HUMAN_ERROR' | 'UNKNOWN'
export type AnalysisStatus = 'PENDING' | 'ANALYZING' | 'COMPLETED' | 'INSUFFICIENT_DATA'

export interface Incident {
  incidentId: string
  title: string
  severity: IncidentSeverity
  startedAt: string
  endedAt?: string
  affectedServices: string[]
  symptoms: string[]
}

export interface IncidentEvent {
  eventId: string
  incidentId: string
  timestamp: string
  source: string
  eventType: 'ERROR' | 'WARNING' | 'INFO'
  message: string
}

export interface RcaResult {
  incidentId: string
  status: AnalysisStatus
  rootCause: RootCauseCategory
  confidence: number  // 0~1
  evidence: string[]
  timeline: string[]
  recommendation: string
  preventionActions: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  incidentId: string
  detail: Record<string, unknown>
}

const INFRA_SIGNALS = ['oom', 'disk full', 'cpu spike', 'memory', 'out of memory', '디스크']
const APP_SIGNALS = ['exception', 'error', 'timeout', 'null pointer', '예외', '오류']
const DB_SIGNALS = ['deadlock', 'connection pool', 'query timeout', 'db error', '데이터베이스']
const NETWORK_SIGNALS = ['connection refused', 'network', 'timeout', 'dns', '네트워크', '연결']
const HUMAN_SIGNALS = ['config change', 'deploy', 'release', '배포', '설정 변경']

function detectRootCause(events: IncidentEvent[]): { category: RootCauseCategory; confidence: number; evidence: string[] } {
  const allMessages = events.map((e) => e.message.toLowerCase()).join(' ')
  const scores: Record<RootCauseCategory, number> = {
    INFRASTRUCTURE: INFRA_SIGNALS.filter((s) => allMessages.includes(s)).length,
    APPLICATION: APP_SIGNALS.filter((s) => allMessages.includes(s)).length,
    DATABASE: DB_SIGNALS.filter((s) => allMessages.includes(s)).length,
    NETWORK: NETWORK_SIGNALS.filter((s) => allMessages.includes(s)).length,
    HUMAN_ERROR: HUMAN_SIGNALS.filter((s) => allMessages.includes(s)).length,
    UNKNOWN: 0,
  }

  const maxScore = Math.max(...Object.values(scores))
  if (maxScore === 0) return { category: 'UNKNOWN', confidence: 0, evidence: [] }

  const category = (Object.entries(scores) as [RootCauseCategory, number][])
    .find(([, score]) => score === maxScore)![0]

  const confidence = Math.min(maxScore / 3, 1.0)
  const evidence = events
    .filter((e) => {
      const signals = category === 'INFRASTRUCTURE' ? INFRA_SIGNALS :
        category === 'APPLICATION' ? APP_SIGNALS :
        category === 'DATABASE' ? DB_SIGNALS :
        category === 'NETWORK' ? NETWORK_SIGNALS : HUMAN_SIGNALS
      return signals.some((s) => e.message.toLowerCase().includes(s))
    })
    .slice(0, 3)
    .map((e) => `[${e.source}] ${e.message}`)

  return { category, confidence, evidence }
}

export class RcaEngineAiV2 {
  private incidents = new Map<string, Incident>()
  private events = new Map<string, IncidentEvent[]>()
  private auditLog: AuditEntry[] = []

  registerIncident(incident: Incident): void {
    this.incidents.set(incident.incidentId, incident)
    this.events.set(incident.incidentId, [])
    this.appendAudit('incident.register', incident.incidentId, { severity: incident.severity, title: incident.title })
  }

  addEvent(event: IncidentEvent): void {
    if (!this.incidents.has(event.incidentId)) throw new Error(`Unknown incident: ${event.incidentId}`)
    const list = this.events.get(event.incidentId) ?? []
    list.push(event)
    this.events.set(event.incidentId, list)
  }

  analyze(incidentId: string): RcaResult {
    const incident = this.incidents.get(incidentId)
    if (!incident) throw new Error(`Unknown incident: ${incidentId}`)

    const events = this.events.get(incidentId) ?? []
    if (events.length === 0) {
      return {
        incidentId,
        status: 'INSUFFICIENT_DATA',
        rootCause: 'UNKNOWN',
        confidence: 0,
        evidence: [],
        timeline: [],
        recommendation: '이벤트 데이터 수집 후 재분석 필요',
        preventionActions: [],
      }
    }

    const { category, confidence, evidence } = detectRootCause(events)
    const timeline = events
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .slice(0, 5)
      .map((e) => `${e.timestamp} [${e.eventType}] ${e.source}: ${e.message}`)

    const recommendations: Record<RootCauseCategory, string> = {
      INFRASTRUCTURE: '서버 리소스 임계값 경고 설정 및 자동 스케일링 구성',
      APPLICATION: '애플리케이션 에러 핸들링 강화 및 서킷 브레이커 패턴 적용',
      DATABASE: '데이터베이스 커넥션 풀 설정 최적화 및 쿼리 인덱싱 검토',
      NETWORK: '네트워크 타임아웃 설정 및 재시도 정책 검토',
      HUMAN_ERROR: '배포 프로세스 자동화 및 변경 관리 절차 강화',
      UNKNOWN: '추가 모니터링 데이터 수집 후 재분석 필요',
    }

    const preventionMap: Record<RootCauseCategory, string[]> = {
      INFRASTRUCTURE: ['리소스 모니터링 강화', '자동 스케일링 정책 수립'],
      APPLICATION: ['에러 핸들링 코드 리뷰', '카나리 배포 도입'],
      DATABASE: ['커넥션 풀 모니터링', '슬로우 쿼리 알림 설정'],
      NETWORK: ['네트워크 헬스체크 강화', '페일오버 구성'],
      HUMAN_ERROR: ['변경 관리 프로세스 강화', 'IaC 도입'],
      UNKNOWN: ['전방위 모니터링 강화'],
    }

    this.appendAudit('incident.analyze', incidentId, { rootCause: category, confidence })

    return {
      incidentId,
      status: 'COMPLETED',
      rootCause: category,
      confidence: Math.round(confidence * 100) / 100,
      evidence,
      timeline,
      recommendation: recommendations[category],
      preventionActions: preventionMap[category],
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, incidentId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, incidentId, detail })
  }
}
