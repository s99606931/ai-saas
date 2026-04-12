/**
 * Chatbot Off-Topic Guard — SVC-AI-ADV-R106
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R106.design.md
 * Plan SC: FR-R106.1 ~ FR-R106.5
 *
 * 공공 챗봇이 업무 범위를 벗어난 질문을 감지하여 차단/안내한다.
 */

export type TopicVerdict = 'IN_SCOPE' | 'OFF_TOPIC' | 'FORBIDDEN'

export interface GuardResult {
  verdict: TopicVerdict
  matchedKeywords: string[]
  suggestedFallback: string
}

export interface GuardStats {
  total: number
  offTopic: number
  forbidden: number
}

const DEFAULT_FORBIDDEN = [
  '대통령',
  '정당',
  '선거',
  '투표',
  '종교',
  '기도',
  '연애',
  '사귀',
]

const FALLBACK_OFF_TOPIC =
  '죄송합니다. 해당 질문은 제가 담당하지 않는 분야입니다. 공공기관 업무 관련 질문을 부탁드립니다.'
const FALLBACK_FORBIDDEN =
  '해당 주제는 답변이 제한되어 있습니다. 업무 관련 내용을 문의해 주세요.'

export class ChatbotOffTopicGuard {
  private allowed: string[] = []
  private forbidden: string[] = [...DEFAULT_FORBIDDEN]
  private counters: GuardStats = { total: 0, offTopic: 0, forbidden: 0 }

  /**
   * FR-R106.1: 도메인 등록.
   */
  registerDomain(allowed: string[], forbidden: string[] = []): void {
    this.allowed = [...allowed]
    this.forbidden = [...new Set([...DEFAULT_FORBIDDEN, ...forbidden])]
  }

  /**
   * FR-R106.2, FR-R106.3: 분류 + 폴백.
   */
  classify(input: string): GuardResult {
    this.counters.total++
    const lower = input.toLowerCase()

    const forbiddenHits = this.forbidden.filter((k) =>
      lower.includes(k.toLowerCase()),
    )
    if (forbiddenHits.length > 0) {
      this.counters.forbidden++
      return {
        verdict: 'FORBIDDEN',
        matchedKeywords: forbiddenHits,
        suggestedFallback: FALLBACK_FORBIDDEN,
      }
    }

    const allowedHits = this.allowed.filter((k) =>
      lower.includes(k.toLowerCase()),
    )
    if (allowedHits.length > 0) {
      return {
        verdict: 'IN_SCOPE',
        matchedKeywords: allowedHits,
        suggestedFallback: '',
      }
    }

    this.counters.offTopic++
    return {
      verdict: 'OFF_TOPIC',
      matchedKeywords: [],
      suggestedFallback: FALLBACK_OFF_TOPIC,
    }
  }

  /**
   * FR-R106.4: 통계.
   */
  stats(): GuardStats {
    return { ...this.counters }
  }

  reset(): void {
    this.counters = { total: 0, offTopic: 0, forbidden: 0 }
  }
}
