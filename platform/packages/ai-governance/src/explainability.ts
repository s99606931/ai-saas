// Design Ref: MTU-N465 §explainability
// Plan SC: FR-XAI.1 ~ FR-XAI.5
//
// 설명가능성 — feature importance 기반 자연어 설명 생성 + 감사 로그.
// 로컬 규칙 기반 생성 (외부 LLM 호출 없음).

export interface DecisionInput {
  decisionId: string;
  subjectId: string;
  features: Record<string, number>;
  outcome: string; // 예: 'approved', 'denied'
  score: number;
  timestamp: string;
}

export interface FeatureContribution {
  feature: string;
  value: number;
  contribution: number; // 부호 있는 SHAP 근사치
  direction: 'positive' | 'negative';
}

export interface Explanation {
  decisionId: string;
  topFeatures: FeatureContribution[];
  narrative: string;
  citizenFriendly: string;
  appealUrl: string;
  generatedAt: string;
}

export interface ExplanationAuditEntry {
  id: string;
  decisionId: string;
  subjectId: string;
  explanationHash: string;
  at: string;
  actor: string;
}

// FR-XAI.1: feature importance 추출 (절댓값 기여도 기준 정렬)
export function extractFeatureContributions(
  input: DecisionInput,
  weights: Record<string, number>,
  topK: number = 5,
): FeatureContribution[] {
  const rows: FeatureContribution[] = [];
  for (const [feature, value] of Object.entries(input.features)) {
    const w = weights[feature] ?? 0;
    const contribution = round4(w * value);
    rows.push({
      feature,
      value: round4(value),
      contribution,
      direction: contribution >= 0 ? 'positive' : 'negative',
    });
  }
  rows.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return rows.slice(0, topK);
}

// FR-XAI.2/3: 자연어 설명 생성 (로컬 템플릿)
export function generateNarrative(
  input: DecisionInput,
  contributions: FeatureContribution[],
): { narrative: string; citizenFriendly: string } {
  const outcomeLabel = input.outcome === 'approved' ? '승인' : input.outcome === 'denied' ? '거부' : input.outcome;
  const positives = contributions.filter((c) => c.direction === 'positive').slice(0, 3);
  const negatives = contributions.filter((c) => c.direction === 'negative').slice(0, 3);

  const techLines: string[] = [
    `결정: ${outcomeLabel} (점수 ${input.score.toFixed(3)})`,
    `주요 긍정 요인: ${positives.map((p) => `${p.feature}(${p.contribution})`).join(', ') || '없음'}`,
    `주요 부정 요인: ${negatives.map((p) => `${p.feature}(${p.contribution})`).join(', ') || '없음'}`,
  ];

  const citizenLines: string[] = [
    `귀하의 신청 건은 "${outcomeLabel}"으로 처리되었습니다.`,
  ];
  if (positives.length > 0) {
    citizenLines.push(
      `유리하게 작용한 요소: ${positives.map((p) => p.feature).join(', ')}`,
    );
  }
  if (negatives.length > 0) {
    citizenLines.push(
      `불리하게 작용한 요소: ${negatives.map((p) => p.feature).join(', ')}`,
    );
  }
  citizenLines.push(
    '본 결정에 이의가 있으시면 안내된 이의제기 절차를 이용하실 수 있습니다.',
  );

  return {
    narrative: techLines.join('\n'),
    citizenFriendly: citizenLines.join(' '),
  };
}

// FR-XAI.5: 감사 로그
export class ExplanationAuditor {
  private entries: ExplanationAuditEntry[] = [];
  private nextId = 1;

  // FR-XAI.4: 이의제기 링크 포함 Explanation 생성
  explain(
    input: DecisionInput,
    weights: Record<string, number>,
    appealUrlBase: string,
    actor: string = 'system',
  ): Explanation {
    const contributions = extractFeatureContributions(input, weights);
    const { narrative, citizenFriendly } = generateNarrative(input, contributions);
    const expl: Explanation = {
      decisionId: input.decisionId,
      topFeatures: contributions,
      narrative,
      citizenFriendly,
      appealUrl: `${appealUrlBase}/${input.decisionId}`,
      generatedAt: new Date().toISOString(),
    };
    const hash = simpleHash(JSON.stringify(expl));
    this.entries.push(
      Object.freeze({
        id: `xai-audit-${this.nextId++}`,
        decisionId: input.decisionId,
        subjectId: input.subjectId,
        explanationHash: hash,
        at: expl.generatedAt,
        actor,
      }),
    );
    return expl;
  }

  history(decisionId?: string): ExplanationAuditEntry[] {
    if (!decisionId) return this.entries.map((e) => ({ ...e }));
    return this.entries
      .filter((e) => e.decisionId === decisionId)
      .map((e) => ({ ...e }));
  }
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

// 단순 non-cryptographic 해시 (감사 무결성 식별자 — 암호 용도 아님)
function simpleHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
