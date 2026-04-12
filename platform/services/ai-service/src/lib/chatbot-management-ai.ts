// Design Ref: §R253 — AI기반 공공 서비스 챗봇 관리
// Plan SC: SVC-AI-ADV-R253-SC01
// CSAP D-06: 감사 로그, N2SF N-05: C/S등급 데이터 차단

export type DataGrade = 'C' | 'S' | 'O'
export type ChatbotStatus = 'ACTIVE' | 'PAUSED' | 'DEGRADED' | 'OFFLINE'
export type IntentCategory = 'FAQ' | 'COMPLAINT' | 'APPLICATION' | 'INQUIRY' | 'UNKNOWN'

export interface ChatbotConfig {
  botId: string
  name: string
  department: string
  dataGrade: DataGrade
  maxSessionMinutes: number
}

export interface ChatMessage {
  botId: string
  sessionId: string
  userInput: string
  timestamp: number
  resolved: boolean
}

export interface ChatbotReport {
  botId: string
  status: ChatbotStatus
  totalSessions: number
  resolvedSessions: number
  resolutionRate: number
  topIntents: IntentCategory[]
  alerts: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  botId: string
  detail: Record<string, unknown>
}

const INTENT_KEYWORDS: Record<IntentCategory, string[]> = {
  FAQ: ['어떻게', '무엇', '뭐', '안내', '방법'],
  COMPLAINT: ['민원', '불만', '문제', '오류', '고장'],
  APPLICATION: ['신청', '접수', '등록', '발급', '처리'],
  INQUIRY: ['조회', '확인', '현황', '상태', '진행'],
  UNKNOWN: [],
}

function classifyIntent(text: string): IntentCategory {
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [IntentCategory, string[]][]) {
    if (intent === 'UNKNOWN') continue
    if (keywords.some((k) => text.includes(k))) return intent
  }
  return 'UNKNOWN'
}

export class ChatbotManagementAi {
  private bots = new Map<string, ChatbotConfig>()
  private messages = new Map<string, ChatMessage[]>()
  private auditLog: AuditEntry[] = []

  registerBot(config: ChatbotConfig): void {
    // N2SF: C/S 등급 데이터를 처리하는 봇 등록 차단
    if (config.dataGrade === 'C' || config.dataGrade === 'S') {
      throw new Error(`BLOCKED: ${config.dataGrade}등급 데이터 처리 챗봇 등록 금지 (N2SF N-05)`)
    }
    this.bots.set(config.botId, config)
    this.messages.set(config.botId, [])
    this.appendAudit('bot.register', config.botId, { name: config.name, department: config.department })
  }

  recordMessage(msg: ChatMessage): void {
    if (!this.bots.has(msg.botId)) throw new Error(`Unknown bot: ${msg.botId}`)
    const list = this.messages.get(msg.botId) ?? []
    list.push(msg)
    this.messages.set(msg.botId, list)
  }

  generateReport(botId: string): ChatbotReport {
    const bot = this.bots.get(botId)
    if (!bot) throw new Error(`Unknown bot: ${botId}`)

    const allMessages = this.messages.get(botId) ?? []
    const alerts: string[] = []

    // 세션별 집계
    const sessions = new Map<string, ChatMessage[]>()
    for (const msg of allMessages) {
      const list = sessions.get(msg.sessionId) ?? []
      list.push(msg)
      sessions.set(msg.sessionId, list)
    }

    const totalSessions = sessions.size
    let resolvedSessions = 0
    for (const msgs of sessions.values()) {
      if (msgs.some((m) => m.resolved)) resolvedSessions++
    }

    const resolutionRate = totalSessions > 0 ? resolvedSessions / totalSessions : 0

    // 인텐트 분석
    const intentCounts = new Map<IntentCategory, number>()
    for (const msg of allMessages) {
      const intent = classifyIntent(msg.userInput)
      intentCounts.set(intent, (intentCounts.get(intent) ?? 0) + 1)
    }
    const topIntents = [...intentCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([intent]) => intent)

    // 상태 판정 및 알림
    let status: ChatbotStatus = 'ACTIVE'
    if (totalSessions === 0) {
      alerts.push('세션 없음 — 챗봇 접근 가능 여부 확인')
      status = 'OFFLINE'
    } else if (resolutionRate < 0.3) {
      alerts.push(`해결률 ${Math.round(resolutionRate * 100)}% — 지식베이스 보강 필요`)
      status = 'DEGRADED'
    } else if (resolutionRate < 0.6) {
      alerts.push(`해결률 ${Math.round(resolutionRate * 100)}% — 성능 개선 권고`)
      status = 'DEGRADED'
    }

    this.appendAudit('bot.report', botId, { status, totalSessions, resolutionRate: Math.round(resolutionRate * 100) / 100 })

    return { botId, status, totalSessions, resolvedSessions, resolutionRate: Math.round(resolutionRate * 100) / 100, topIntents, alerts }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, botId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, botId, detail })
  }
}
