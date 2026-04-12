// Design Ref: MTU-N425 §LLM 출력 품질
// Plan SC: FR-N425.1~5

export interface QualityInput {
  question: string;
  context: string;
  answer: string;
}

export interface QualityScores {
  faithfulness: number;
  coherence: number;
  relevance: number;
  hallucinationRisk: number;
  overall: number;
}

export interface QualityVerdict {
  scores: QualityScores;
  passed: boolean;
  shouldRegenerate: boolean;
  issues: string[];
}

export class LLMOutputQuality {
  /** FR-N425.1 Faithfulness: answer의 claim 중 context에서 근거 발견 비율 */
  scoreFaithfulness(input: QualityInput): number {
    const claims = this.extractClaims(input.answer);
    if (claims.length === 0) return 1;
    const ctxLower = input.context.toLowerCase();
    let supported = 0;
    for (const claim of claims) {
      const tokens = claim.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
      if (tokens.length === 0) continue;
      const hits = tokens.filter((t) => ctxLower.includes(t)).length;
      if (hits / tokens.length >= 0.5) supported++;
    }
    return +(supported / claims.length).toFixed(3);
  }

  /** FR-N425.2 Coherence: 문장 길이 편차 + 반복 검사 */
  scoreCoherence(text: string): number {
    const sentences = text.split(/[.!?\u3002]/).map((s) => s.trim()).filter(Boolean);
    if (sentences.length < 2) return 1;
    const lens = sentences.map((s) => s.length);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
    const stdev = Math.sqrt(variance);
    const cv = stdev / Math.max(1, mean);
    const seen = new Set<string>();
    let repeated = 0;
    for (const s of sentences) {
      if (seen.has(s)) repeated++;
      seen.add(s);
    }
    const repetitionPenalty = repeated / sentences.length;
    return +Math.max(0, 1 - cv * 0.3 - repetitionPenalty).toFixed(3);
  }

  /** FR-N425.3 Relevance: 질문 키워드가 답변에 등장 */
  scoreRelevance(input: QualityInput): number {
    const qTokens = input.question
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1);
    if (qTokens.length === 0) return 1;
    const answerLower = input.answer.toLowerCase();
    const hits = qTokens.filter((t) => answerLower.includes(t)).length;
    return +(hits / qTokens.length).toFixed(3);
  }

  /** FR-N425.4 환각 위험 */
  scoreHallucinationRisk(input: QualityInput): number {
    const faith = this.scoreFaithfulness(input);
    const unsupportedDigits = this.countUnsupportedNumbers(input);
    const risk = (1 - faith) * 0.7 + Math.min(1, unsupportedDigits * 0.2) * 0.3;
    return +Math.min(1, risk).toFixed(3);
  }

  private countUnsupportedNumbers(input: QualityInput): number {
    const numbers = input.answer.match(/\d+(\.\d+)?/g) ?? [];
    let unsupported = 0;
    for (const n of numbers) {
      if (!input.context.includes(n)) unsupported++;
    }
    return unsupported;
  }

  private extractClaims(text: string): string[] {
    return text
      .split(/[.!?\u3002]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4);
  }

  /** FR-N425.5 종합 평가 */
  evaluate(input: QualityInput): QualityVerdict {
    const faithfulness = this.scoreFaithfulness(input);
    const coherence = this.scoreCoherence(input.answer);
    const relevance = this.scoreRelevance(input);
    const hallucinationRisk = this.scoreHallucinationRisk(input);
    const overall = +(
      faithfulness * 0.4 +
      relevance * 0.3 +
      coherence * 0.2 +
      (1 - hallucinationRisk) * 0.1
    ).toFixed(3);

    const issues: string[] = [];
    if (faithfulness < 0.6) issues.push('맥락 충실성 부족');
    if (relevance < 0.5) issues.push('질문과 관련성 낮음');
    if (coherence < 0.6) issues.push('문장 일관성 부족');
    if (hallucinationRisk > 0.4) issues.push('환각 위험');

    return {
      scores: { faithfulness, coherence, relevance, hallucinationRisk, overall },
      passed: overall >= 0.7 && hallucinationRisk < 0.4,
      shouldRegenerate: overall < 0.6 || hallucinationRisk > 0.6,
      issues,
    };
  }
}

export const llmOutputQuality = new LLMOutputQuality();
