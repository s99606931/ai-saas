// Design Ref: §R164 AI기반규정준수챗봇
// Plan SC: FR-R164.1~5

export type ComplianceStandard = 'CSAP' | 'ISMS-P' | 'N2SF' | 'GDPR' | '행안부감리';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  referenceIds?: string[];
}

export interface ComplianceRule {
  id: string;
  standard: ComplianceStandard;
  title: string;
  description: string;
  keywords: string[];
  severity: 'high' | 'medium' | 'low';
}

export interface AuditEntry {
  sessionId: string;
  userId: string;
  action: string;
  timestamp: string;
  query?: string;
}

// FR-R164.1 규정 KB + 키워드 검색
export class ComplianceChatbotAi {
  private rules: ComplianceRule[] = [];
  private sessions = new Map<string, ChatMessage[]>();
  private auditLog: AuditEntry[] = [];

  /** FR-R164.1 규정 등록 */
  registerRule(rule: ComplianceRule): void {
    this.rules.push(rule);
  }

  /** FR-R164.2 키워드 기반 규정 검색 */
  searchRules(query: string): ComplianceRule[] {
    const lower = query.toLowerCase();
    return this.rules.filter((r) =>
      r.keywords.some((k) => lower.includes(k.toLowerCase())) ||
      r.title.toLowerCase().includes(lower) ||
      r.description.toLowerCase().includes(lower)
    );
  }

  /** FR-R164.3 규정 준수 질의응답 */
  chat(sessionId: string, userId: string, userMessage: string): ChatMessage {
    // N2SF: O등급 쿼리만 처리
    const matched = this.searchRules(userMessage);
    const answer = this.buildAnswer(userMessage, matched);

    const msg: ChatMessage = {
      role: 'assistant',
      content: answer,
      timestamp: new Date().toISOString(),
      referenceIds: matched.map((r) => r.id),
    };

    const history = this.sessions.get(sessionId) ?? [];
    history.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });
    history.push(msg);
    this.sessions.set(sessionId, history);

    // FR-R164.5 감사 로그 (CSAP D-06)
    this.auditLog.push({
      sessionId,
      userId,
      action: 'CHAT_QUERY',
      timestamp: new Date().toISOString(),
      query: userMessage.substring(0, 200),
    });

    return msg;
  }

  /** FR-R164.4 대화 이력 조회 */
  getHistory(sessionId: string): ChatMessage[] {
    return this.sessions.get(sessionId) ?? [];
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  private buildAnswer(query: string, matched: ComplianceRule[]): string {
    if (matched.length === 0) {
      return `"${query}"에 해당하는 규정을 찾지 못했습니다. 더 구체적인 키워드로 질의해주세요.`;
    }
    const topRules = matched.slice(0, 3);
    const lines = topRules.map(
      (r) => `[${r.standard}/${r.id}] ${r.title}: ${r.description}`
    );
    return `관련 규정 ${matched.length}건 발견:\n\n${lines.join('\n\n')}`;
  }
}

export const complianceChatbotAi = new ComplianceChatbotAi();
