// AI Decision Explainer (XAI) — FR-R84.1~R84.5
// Design Ref: SVC-AI-ADV-R84 DESIGN §4단계서술
// Plan SC: 설명 완전성 ≥ 90%, Top-K 기여 식별
// CSAP: D-06 감사 / N2SF: N-05 / 행정기본법 제20조

export type DataGrade = 'C' | 'S' | 'O';

export interface FeatureValue {
  name: string;
  value: number;
  description?: string;
}

export interface DecisionInput {
  id: string;
  tenantId: string;
  label: string;
  score: number;
  features: FeatureValue[];
  weights: Record<string, number>;
  threshold: number;
  grade: DataGrade;
}

export interface Contribution {
  feature: string;
  value: number;
  weight: number;
  contribution: number;
  percent: number;
}

export interface AlternativeScenario {
  feature: string;
  originalValue: number;
  flippedValue: number;
  newScore: number;
  wouldFlipLabel: boolean;
}

export interface Explanation {
  decisionId: string;
  label: string;
  score: number;
  threshold: number;
  passed: boolean;
  topContributions: Contribution[];
  alternatives: AlternativeScenario[];
  narrative: string;
}

export type AuditAction =
  | 'EXPLAIN_START'
  | 'EXPLAIN_DONE'
  | 'GRADE_BLOCKED'
  | 'MASKED';

export interface AuditEvent {
  action: AuditAction;
  detail?: string;
  at: number;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\b0\d{1,2}-?\d{3,4}-?\d{4}\b/g;
const RRN_RE = /\b\d{6}-\d{7}\b/g;

function maskPII(text: string): { masked: string; changed: boolean } {
  const masked = text
    .replace(EMAIL_RE, '***@***')
    .replace(PHONE_RE, '***-****-****')
    .replace(RRN_RE, '******-*******');
  return { masked, changed: masked !== text };
}

export class AIDecisionExplainer {
  private readonly auditLog: AuditEvent[] = [];

  explain(input: DecisionInput, topK = 3): Explanation {
    if (input.grade !== 'O') {
      this.audit('GRADE_BLOCKED', `${input.id}:${input.grade}`);
      throw new Error('EXPLAIN_GRADE_BLOCKED');
    }
    this.audit('EXPLAIN_START', input.id);

    // 1. 기여도 계산
    const contributions: Contribution[] = input.features.map((f) => {
      const weight = input.weights[f.name] ?? 0;
      return {
        feature: f.name,
        value: f.value,
        weight,
        contribution: f.value * weight,
        percent: 0,
      };
    });

    const totalAbs = contributions.reduce((s, c) => s + Math.abs(c.contribution), 0);
    if (totalAbs > 0) {
      for (const c of contributions) {
        c.percent = (Math.abs(c.contribution) / totalAbs) * 100;
      }
    }

    // 2. Top-K 정렬
    const sorted = [...contributions].sort(
      (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
    );
    const top = sorted.slice(0, topK);

    // 3. 대안 시나리오 계산
    const alternatives: AlternativeScenario[] = [];
    const passed = input.score >= input.threshold;

    for (const f of input.features) {
      const weight = input.weights[f.name] ?? 0;
      // ±50% flip
      const directions = [f.value * 1.5, f.value * 0.5, -f.value];
      for (const flipped of directions) {
        const delta = (flipped - f.value) * weight;
        const newScore = input.score + delta;
        const newPassed = newScore >= input.threshold;
        if (newPassed !== passed) {
          alternatives.push({
            feature: f.name,
            originalValue: f.value,
            flippedValue: flipped,
            newScore,
            wouldFlipLabel: true,
          });
          break;
        }
      }
      if (alternatives.length >= 3) {
        break;
      }
    }

    // 4. 4단계 서술 생성
    const narrative = this.buildNarrative(input, top, alternatives, passed);
    const { masked, changed } = maskPII(narrative);
    if (changed) {
      this.audit('MASKED', input.id);
    }

    this.audit('EXPLAIN_DONE', input.id);

    return {
      decisionId: input.id,
      label: input.label,
      score: input.score,
      threshold: input.threshold,
      passed,
      topContributions: top,
      alternatives,
      narrative: masked,
    };
  }

  getAuditLog(): AuditEvent[] {
    return [...this.auditLog];
  }

  private buildNarrative(
    input: DecisionInput,
    top: Contribution[],
    alts: AlternativeScenario[],
    passed: boolean,
  ): string {
    const lines: string[] = [];

    // 1단계: 입력 요약
    const topFeatureDesc = top
      .slice(0, 3)
      .map((c) => `${c.feature}=${c.value.toFixed(2)}`)
      .join(', ');
    lines.push(
      `[1단계 입력] ${input.features.length}개 특징 중 상위 영향: ${topFeatureDesc}`,
    );

    // 2단계: 특징 가중
    if (top[0]) {
      lines.push(
        `[2단계 가중] 가장 큰 영향: '${top[0].feature}' (기여도 ${top[0].percent.toFixed(1)}%)`,
      );
    } else {
      lines.push('[2단계 가중] 유의미한 특징 없음');
    }

    // 3단계: 판정 근거
    const result = passed ? '충족' : '미달';
    lines.push(
      `[3단계 판정] 최종 점수 ${input.score.toFixed(2)}, 임계값 ${input.threshold.toFixed(2)}, 결과: ${input.label} (${result})`,
    );

    // 4단계: 대안
    if (alts.length > 0 && alts[0]) {
      const a = alts[0];
      lines.push(
        `[4단계 대안] '${a.feature}'가 ${a.originalValue.toFixed(2)} → ${a.flippedValue.toFixed(2)}로 변할 경우 판정이 뒤집힘 (새 점수 ${a.newScore.toFixed(2)})`,
      );
    } else {
      lines.push('[4단계 대안] 단일 특징 변경으로 판정이 뒤집히지 않음 (안정적 결정)');
    }

    return lines.join('\n');
  }

  private audit(action: AuditAction, detail?: string): void {
    this.auditLog.push({ action, detail, at: Date.now() });
  }
}
