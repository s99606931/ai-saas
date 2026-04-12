// Design Ref: MTU-N448 §챗봇 컨텍스트 v2
// Plan SC: FR-N448.1~5

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  tokens: number;
}

export interface ConversationSession {
  sessionId: string;
  userId: string;
  messages: ChatMessage[];
  entities: Record<string, string>;
  intents: string[];
  lastUpdated: number;
}

export interface ContextSummary {
  sessionId: string;
  compressedText: string;
  tokenCount: number;
  droppedMessages: number;
}

export interface ProactiveSuggestion {
  sessionId: string;
  reason: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
}

export interface MultiTurnMetric {
  totalTurns: number;
  avgLatencyMs: number;
  entityRetentionRate: number;
}

export class ChatbotContextV2 {
  /** FR-N448.1 세션 생성/추가 */
  addMessage(session: ConversationSession, message: ChatMessage): ConversationSession {
    return {
      ...session,
      messages: [...session.messages, message],
      lastUpdated: message.timestamp,
    };
  }

  /** FR-N448.2 엔티티/의도 누적 */
  trackEntities(session: ConversationSession, extracted: Record<string, string>): ConversationSession {
    return {
      ...session,
      entities: { ...session.entities, ...extracted },
    };
  }

  trackIntent(session: ConversationSession, intent: string): ConversationSession {
    return {
      ...session,
      intents: [...session.intents, intent],
    };
  }

  /** FR-N448.3 컨텍스트 요약 (토큰 예산 관리) */
  summarize(session: ConversationSession, maxTokens: number): ContextSummary {
    let tokens = 0;
    const kept: ChatMessage[] = [];
    // 최근부터 역순으로 유지
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const m = session.messages[i];
      if (!m) continue;
      if (tokens + m.tokens > maxTokens) break;
      kept.unshift(m);
      tokens += m.tokens;
    }
    const dropped = session.messages.length - kept.length;
    const compressed = kept.map((m) => `[${m.role}] ${m.text}`).join('\n');
    return {
      sessionId: session.sessionId,
      compressedText: compressed,
      tokenCount: tokens,
      droppedMessages: dropped,
    };
  }

  /** FR-N448.4 프로액티브 제안 트리거 */
  generateSuggestion(session: ConversationSession): ProactiveSuggestion | null {
    const lastMsg = session.messages.at(-1);
    if (!lastMsg) return null;

    if (session.intents.includes('문제보고') && !session.intents.includes('해결확인')) {
      return {
        sessionId: session.sessionId,
        reason: '문제보고 후 해결 미확인',
        suggestion: '이전에 보고하신 문제가 해결되었나요?',
        priority: 'medium',
      };
    }
    if (session.messages.length >= 8 && session.messages.length % 5 === 0) {
      return {
        sessionId: session.sessionId,
        reason: '장시간 대화',
        suggestion: '대화 내용을 요약해 드릴까요?',
        priority: 'low',
      };
    }
    return null;
  }

  /** FR-N448.5 멀티턴 평가 */
  evaluate(sessions: ConversationSession[]): MultiTurnMetric {
    const totalTurns = sessions.reduce<number>((a, s) => a + s.messages.length, 0);
    let latencySum = 0;
    let latencyCount = 0;
    for (const s of sessions) {
      for (let i = 1; i < s.messages.length; i++) {
        const prev = s.messages[i - 1];
        const cur = s.messages[i];
        if (prev && cur && prev.role === 'user' && cur.role === 'assistant') {
          latencySum += cur.timestamp - prev.timestamp;
          latencyCount++;
        }
      }
    }
    const avgLatency = latencyCount === 0 ? 0 : latencySum / latencyCount;
    const retention =
      sessions.length === 0
        ? 0
        : sessions.reduce<number>((a, s) => a + Object.keys(s.entities).length, 0) / sessions.length;
    return {
      totalTurns,
      avgLatencyMs: +avgLatency.toFixed(2),
      entityRetentionRate: +retention.toFixed(2),
    };
  }
}

export const chatbotContextV2 = new ChatbotContextV2();
