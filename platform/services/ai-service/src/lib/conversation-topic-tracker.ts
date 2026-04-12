/**
 * Conversation Topic Tracker — SVC-AI-ADV-R131
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R131.design.md
 * Plan SC: FR-R131.1 ~ FR-R131.7
 *
 * 세션별 키워드 프로필 + Jaccard 유사도 기반 주제 드리프트 추적.
 * 한국어 2-gram + 영어 단어 TF 기반 키워드 추출, PII 마스킹.
 * CSAP D-06 감사, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface TrackerOptions {
  topKKeywords?: number
  similarityThreshold?: number
  driftAlertThreshold?: number
  maxMessagesPerSession?: number
}

export interface MessageAnalysis {
  sessionId: string
  index: number
  similarity: number
  drifted: boolean
  contribution: number
  maskedText: string
}

export interface TopicDriftEvent {
  sessionId: string
  driftScore: number
  timestamp: number
}

export interface TopicAuditEntry {
  action: 'sessionStarted' | 'messageAdded' | 'driftDetected' | 'alertEmitted'
  sessionId: string
  timestamp: number
  details: Record<string, unknown>
}

interface SessionState {
  sessionId: string
  initialKeywords: Set<string>
  driftScore: number
  messages: MessageAnalysis[]
  alerted: boolean
}

export class ConversationTopicTracker {
  private readonly topK: number
  private readonly simThreshold: number
  private readonly driftAlertThreshold: number
  private readonly maxMessages: number

  private readonly sessions = new Map<string, SessionState>()
  private readonly listeners: Array<(e: TopicDriftEvent) => void> = []
  private readonly auditLog: TopicAuditEntry[] = []

  constructor(grade: DataGrade, options: TrackerOptions = {}) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 Conversation Topic Tracker 사용 금지 (N2SF N-05)`,
      )
    }
    this.topK = options.topKKeywords ?? 10
    this.simThreshold = options.similarityThreshold ?? 0.3
    this.driftAlertThreshold = options.driftAlertThreshold ?? 2.0
    this.maxMessages = options.maxMessagesPerSession ?? 200
  }

  /** FR-R131.1 */
  startSession(sessionId: string, initialMessage: string): void {
    if (!sessionId.trim()) {
      throw new Error('sessionId must not be empty')
    }
    if (this.sessions.has(sessionId)) {
      throw new Error(`session already exists: ${sessionId}`)
    }
    const masked = this.mask(initialMessage)
    const keywords = this.extractKeywords(masked)
    this.sessions.set(sessionId, {
      sessionId,
      initialKeywords: keywords,
      driftScore: 0,
      messages: [],
      alerted: false,
    })
    this.audit({
      action: 'sessionStarted',
      sessionId,
      timestamp: Date.now(),
      details: { keywordCount: keywords.size },
    })
  }

  /** FR-R131.2 */
  addMessage(sessionId: string, message: string): MessageAnalysis {
    const state = this.sessions.get(sessionId)
    if (!state) {
      throw new Error(`unknown session: ${sessionId}`)
    }
    if (state.messages.length >= this.maxMessages) {
      throw new Error(`max messages exceeded for session: ${sessionId}`)
    }
    const masked = this.mask(message)
    const keywords = this.extractKeywords(masked)
    const similarity = this.computeSimilarity(state.initialKeywords, keywords)
    const drifted = similarity < this.simThreshold
    const contribution = drifted ? 1 - similarity : 0
    if (drifted) state.driftScore += contribution

    const analysis: MessageAnalysis = {
      sessionId,
      index: state.messages.length,
      similarity,
      drifted,
      contribution,
      maskedText: masked,
    }
    state.messages.push(analysis)

    this.audit({
      action: 'messageAdded',
      sessionId,
      timestamp: Date.now(),
      details: { index: analysis.index, similarity, drifted },
    })

    if (drifted) {
      this.audit({
        action: 'driftDetected',
        sessionId,
        timestamp: Date.now(),
        details: { driftScore: state.driftScore },
      })
    }

    if (
      state.driftScore >= this.driftAlertThreshold &&
      !state.alerted
    ) {
      state.alerted = true
      const event: TopicDriftEvent = {
        sessionId,
        driftScore: state.driftScore,
        timestamp: Date.now(),
      }
      for (const l of this.listeners) l(event)
      this.audit({
        action: 'alertEmitted',
        sessionId,
        timestamp: event.timestamp,
        details: { driftScore: state.driftScore },
      })
    }

    return analysis
  }

  /** FR-R131.3 */
  extractKeywords(text: string): Set<string> {
    const freq = new Map<string, number>()

    // 한국어 2-gram
    const koreanBlocks = text.match(/[\uac00-\ud7af]+/g) ?? []
    for (const block of koreanBlocks) {
      if (block.length < 2) continue
      for (let i = 0; i < block.length - 1; i++) {
        const bigram = block.slice(i, i + 2)
        freq.set(bigram, (freq.get(bigram) ?? 0) + 1)
      }
    }

    // 영어 단어
    const englishWords = text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []
    for (const word of englishWords) {
      freq.set(word, (freq.get(word) ?? 0) + 1)
    }

    const sorted = [...freq.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0])
    })

    return new Set(sorted.slice(0, this.topK).map((e) => e[0]))
  }

  /** FR-R131.4 */
  computeSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0
    let inter = 0
    for (const k of a) if (b.has(k)) inter++
    const union = a.size + b.size - inter
    if (union === 0) return 0
    return inter / union
  }

  /** FR-R131.5 */
  getDriftScore(sessionId: string): number {
    const state = this.sessions.get(sessionId)
    if (!state) {
      throw new Error(`unknown session: ${sessionId}`)
    }
    return state.driftScore
  }

  /** FR-R131.6 */
  onTopicDrift(listener: (e: TopicDriftEvent) => void): void {
    this.listeners.push(listener)
  }

  /** FR-R131.7 */
  getAuditLog(): TopicAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private mask(text: string): string {
    return text
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '***@***')
      .replace(/\b\d{6}-\d{7}\b/g, '******-*******')
      .replace(/\b010-\d{4}-\d{4}\b/g, '010-****-****')
  }

  private audit(entry: TopicAuditEntry): void {
    this.auditLog.push(entry)
  }
}
