// Design Ref: MTU-N456 §pia
// Plan SC: FR-PIA.1 ~ FR-PIA.5
//
// 개인정보 영향평가(PIA) 자동화. 처리 항목 → 위험도 산정 → 보호대책 추천 →
// 보고서 초안 + 재평가 주기 관리. 외부 AI API 호출 없음.

export type PiaSensitivity = 'high' | 'medium' | 'low';
export type PiaPurposeLegalBasis =
  | 'consent'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interest'
  | 'public_task'
  | 'legitimate_interest';

export interface PiaProcessingItem {
  field: string;
  category: 'identity' | 'sensitive' | 'financial' | 'medical' | 'location' | 'biometric';
  purpose: string;
  legalBasis?: PiaPurposeLegalBasis;
  retentionMonths: number;
  sharedExternally: boolean;
}

export interface PiaRiskScore {
  itemField: string;
  sensitivity: PiaSensitivity;
  score: number; // 0~100
  factors: string[];
}

export interface PiaAssessment {
  id: string;
  system: string;
  overallScore: number;
  overallSensitivity: PiaSensitivity;
  items: PiaRiskScore[];
  recommendedControls: string[];
  assessedAt: string;
  nextReviewAt: string;
  legalBasisGaps: string[];
}

const CATEGORY_WEIGHT: Record<PiaProcessingItem['category'], number> = {
  identity: 30,
  sensitive: 80,
  financial: 60,
  medical: 80,
  location: 50,
  biometric: 90,
};

// FR-PIA.1 + FR-PIA.2: 위험도 산정 + 법적 근거 매핑
export class PiaAssessor {
  assess(system: string, items: PiaProcessingItem[], now: Date = new Date()): PiaAssessment {
    const itemScores = items.map((i) => this.scoreItem(i));
    const overallScore = itemScores.length
      ? Math.round(itemScores.reduce((s, x) => s + x.score, 0) / itemScores.length)
      : 0;
    const overallSensitivity = this.bucket(overallScore);

    // FR-PIA.2: 법적 근거 누락 탐지
    const legalBasisGaps = items
      .filter((i) => !i.legalBasis)
      .map((i) => i.field);

    // FR-PIA.3: 보호대책 추천
    const recommendedControls = this.recommendControls(items, overallSensitivity);

    // FR-PIA.5: 재평가 주기 관리 (3년)
    const nextReview = new Date(now);
    nextReview.setFullYear(nextReview.getFullYear() + 3);

    return {
      id: `pia-${now.getTime()}`,
      system,
      overallScore,
      overallSensitivity,
      items: itemScores,
      recommendedControls,
      assessedAt: now.toISOString(),
      nextReviewAt: nextReview.toISOString(),
      legalBasisGaps,
    };
  }

  // FR-PIA.4: 보고서 자동 생성 (간단 Markdown)
  renderReport(assessment: PiaAssessment): string {
    const lines: string[] = [];
    lines.push(`# 개인정보 영향평가 보고서 — ${assessment.system}`);
    lines.push(`- 평가일: ${assessment.assessedAt}`);
    lines.push(`- 다음 재평가: ${assessment.nextReviewAt}`);
    lines.push(`- 전체 위험도: ${assessment.overallScore} (${assessment.overallSensitivity})`);
    lines.push('');
    lines.push('## 항목별 위험도');
    for (const it of assessment.items) {
      lines.push(
        `- ${it.itemField}: ${it.score} (${it.sensitivity}) — ${it.factors.join(', ')}`,
      );
    }
    if (assessment.legalBasisGaps.length > 0) {
      lines.push('');
      lines.push(`## 법적 근거 누락: ${assessment.legalBasisGaps.join(', ')}`);
    }
    lines.push('');
    lines.push('## 권고 보호대책');
    for (const c of assessment.recommendedControls) lines.push(`- ${c}`);
    return lines.join('\n');
  }

  private scoreItem(item: PiaProcessingItem): PiaRiskScore {
    let score = CATEGORY_WEIGHT[item.category];
    const factors: string[] = [`category:${item.category}`];
    if (item.sharedExternally) {
      score += 10;
      factors.push('external_sharing');
    }
    if (item.retentionMonths > 60) {
      score += 5;
      factors.push('long_retention');
    }
    if (!item.legalBasis) {
      score += 5;
      factors.push('missing_legal_basis');
    }
    score = Math.min(100, score);
    return {
      itemField: item.field,
      sensitivity: this.bucket(score),
      score,
      factors,
    };
  }

  private bucket(score: number): PiaSensitivity {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private recommendControls(
    items: PiaProcessingItem[],
    sensitivity: PiaSensitivity,
  ): string[] {
    const ctrl = new Set<string>();
    ctrl.add('접근 통제 (RBAC) 강제 (CSAP D-08)');
    ctrl.add('전송 구간 TLS 1.3 이상 (CSAP D-09)');
    ctrl.add('감사 로그 append-only (CSAP D-06)');
    if (sensitivity !== 'low') {
      ctrl.add('저장 암호화 AES-256');
      ctrl.add('최소 권한 원칙 검토');
    }
    if (items.some((i) => i.category === 'sensitive' || i.category === 'biometric')) {
      ctrl.add('민감/고유식별정보 별도 저장소 분리');
      ctrl.add('가명처리/익명화 검토');
    }
    if (items.some((i) => i.sharedExternally)) {
      ctrl.add('국외이전 적법성 검토 (개보법 §28-8)');
    }
    return Array.from(ctrl);
  }
}
