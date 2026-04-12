// Design Ref: MTU-N456 §PIA 자동화
// Plan SC: FR-PIA.1~5

export interface DataCategory {
  code: string;
  name: string;
  sensitivityLevel: 1 | 2 | 3 | 4 | 5;
  legalBasis?: string;
}

export interface ProcessingActivity {
  id: string;
  systemName: string;
  categories: DataCategory[];
  subjectCount: number;
  retentionDays: number;
  thirdPartySharing: boolean;
}

export interface PiaRiskScore {
  activityId: string;
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
}

export interface PiaReport {
  activityId: string;
  risk: PiaRiskScore;
  legalBases: Array<{ category: string; basis: string }>;
  safeguards: string[];
  nextReviewDate: string;
}

export class PiaAutomation {
  private legalBasisMap = new Map<string, string>();

  registerLegalBasis(categoryCode: string, basis: string): void {
    this.legalBasisMap.set(categoryCode, basis);
  }

  /** FR-PIA.1 위험도 산정 */
  assessRisk(activity: ProcessingActivity): PiaRiskScore {
    let score = 0;
    const factors: string[] = [];
    const maxSens = Math.max(...activity.categories.map((c) => c.sensitivityLevel), 0);
    score += maxSens * 10;
    if (maxSens >= 4) factors.push('민감정보 포함');
    if (activity.subjectCount >= 50000) {
      score += 20;
      factors.push('대규모 처리(5만+)');
    }
    if (activity.retentionDays > 365 * 3) {
      score += 10;
      factors.push('장기 보유');
    }
    if (activity.thirdPartySharing) {
      score += 15;
      factors.push('제3자 제공');
    }
    let level: PiaRiskScore['level'] = 'low';
    if (score >= 60) level = 'critical';
    else if (score >= 40) level = 'high';
    else if (score >= 20) level = 'medium';
    return { activityId: activity.id, score, level, factors };
  }

  /** FR-PIA.2 법적 근거 매핑 */
  mapLegalBases(activity: ProcessingActivity): Array<{ category: string; basis: string }> {
    return activity.categories.map((c) => ({
      category: c.code,
      basis: this.legalBasisMap.get(c.code) ?? c.legalBasis ?? '개인정보보호법 §15(동의)',
    }));
  }

  /** FR-PIA.3 보호대책 추천 */
  recommendSafeguards(risk: PiaRiskScore): string[] {
    const safeguards = new Set<string>(['접근통제(RBAC)', '전송 암호화(TLS 1.3)', '감사 로그(append-only)']);
    if (risk.level === 'high' || risk.level === 'critical') {
      safeguards.add('저장 암호화(AES-256)');
      safeguards.add('가명처리');
      safeguards.add('DLP 적용');
    }
    if (risk.factors.includes('제3자 제공')) safeguards.add('위탁 계약서 + 관리감독');
    if (risk.factors.includes('대규모 처리(5만+)')) safeguards.add('PIA 연 1회 재평가');
    return Array.from(safeguards);
  }

  /** FR-PIA.4 보고서 생성 + FR-PIA.5 재평가 주기 */
  buildReport(activity: ProcessingActivity, today: Date): PiaReport {
    const risk = this.assessRisk(activity);
    const legalBases = this.mapLegalBases(activity);
    const safeguards = this.recommendSafeguards(risk);
    const years = risk.level === 'critical' ? 1 : 3;
    const nextReview = new Date(today);
    nextReview.setFullYear(nextReview.getFullYear() + years);
    return {
      activityId: activity.id,
      risk,
      legalBases,
      safeguards,
      nextReviewDate: nextReview.toISOString().slice(0, 10),
    };
  }
}

export const piaAutomation = new PiaAutomation();
