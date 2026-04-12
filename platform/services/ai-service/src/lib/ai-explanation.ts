// Design Ref: MTU-N465 §AI 설명 가능성
// Plan SC: FR-XAI.1~5

export interface FeatureContribution {
  feature: string;
  value: string | number;
  weight: number;
}

export interface AiDecision {
  decisionId: string;
  modelId: string;
  outcome: string;
  contributions: FeatureContribution[];
  timestamp: string;
}

export interface HumanExplanation {
  decisionId: string;
  summary: string;
  details: string[];
  citizenFriendly: string;
  appealLink: string;
}

export interface ExplanationAuditEntry {
  decisionId: string;
  deliveredTo: string;
  at: string;
}

export class AiExplanation {
  private auditLog: ExplanationAuditEntry[] = [];

  /** FR-XAI.1 feature importance 추출 */
  extractImportance(decision: AiDecision, topK = 3): FeatureContribution[] {
    return [...decision.contributions]
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, topK);
  }

  /** FR-XAI.2 자연어 설명 생성 */
  generateExplanation(decision: AiDecision, topK = 3): HumanExplanation {
    const top = this.extractImportance(decision, topK);
    const details = top.map(
      (c) => `${c.feature}(${c.value}): 기여도 ${(c.weight * 100).toFixed(1)}%`,
    );
    const friendly = `귀하의 요청은 ${top.length}개 주요 요인을 종합하여 '${decision.outcome}'로 결정되었습니다.`;
    return {
      decisionId: decision.decisionId,
      summary: `모델 ${decision.modelId}이 ${top[0]?.feature ?? '주요 항목'}을 근거로 결정`,
      details,
      citizenFriendly: friendly,
      appealLink: `/appeals/new?decisionId=${decision.decisionId}`,
    };
  }

  /** FR-XAI.3/4 민원인 친화 포맷 + 이의제기 */
  formatForCitizen(explanation: HumanExplanation): string {
    return [
      `[결정 사유]`,
      explanation.citizenFriendly,
      ``,
      `[세부 근거]`,
      ...explanation.details.map((d) => `- ${d}`),
      ``,
      `동의하지 않으시면 이의제기: ${explanation.appealLink}`,
    ].join('\n');
  }

  /** FR-XAI.5 감사 로그 */
  logDelivery(decisionId: string, deliveredTo: string): ExplanationAuditEntry {
    const entry: ExplanationAuditEntry = { decisionId, deliveredTo, at: new Date().toISOString() };
    this.auditLog.push(entry);
    return entry;
  }

  getAuditLog(): ExplanationAuditEntry[] {
    return [...this.auditLog];
  }
}

export const aiExplanation = new AiExplanation();
