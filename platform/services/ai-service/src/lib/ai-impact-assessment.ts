// Design Ref: MTU-N463 §AI 영향 평가
// Plan SC: FR-AIA.1~5

export type AiUseCase = 'recruitment' | 'education' | 'healthcare' | 'justice' | 'credit' | 'general';
export type RiskLevel = 'minimal' | 'limited' | 'high' | 'unacceptable';

export interface AiSystemProfile {
  id: string;
  name: string;
  useCase: AiUseCase;
  automatedDecision: boolean;
  affectsVulnerable: boolean;
  usesPersonalData: boolean;
}

export interface AiaResult {
  systemId: string;
  useCase: AiUseCase;
  risk: RiskLevel;
  obligations: string[];
  approvalRequired: boolean;
  nextReviewDate: string;
}

export class AiImpactAssessment {
  /** FR-AIA.1 용도 분류 + FR-AIA.2 위험도 4단계 */
  classify(profile: AiSystemProfile): RiskLevel {
    const highRiskCases: AiUseCase[] = ['recruitment', 'healthcare', 'justice', 'credit'];
    const prohibited = profile.useCase === 'justice' && profile.affectsVulnerable && profile.automatedDecision;
    if (prohibited) return 'unacceptable';
    if (highRiskCases.includes(profile.useCase)) return 'high';
    if (profile.usesPersonalData || profile.automatedDecision) return 'limited';
    return 'minimal';
  }

  /** FR-AIA.3 의무 체크리스트 */
  getObligations(level: RiskLevel): string[] {
    const base = ['기술 문서 작성', '위험 관리'];
    if (level === 'minimal') return [];
    if (level === 'limited') return [...base, '투명성 정보 제공'];
    if (level === 'high')
      return [
        ...base,
        '데이터 거버넌스',
        '인간 감독',
        '정확성·견고성 검증',
        '사후 모니터링',
        '감사 추적',
      ];
    return ['배포 금지', '즉시 제거'];
  }

  /** FR-AIA.4 배포 승인 게이트 */
  requiresApproval(level: RiskLevel): boolean {
    return level === 'high' || level === 'unacceptable';
  }

  /** FR-AIA.5 보고서 생성 + 재평가 주기 */
  assess(profile: AiSystemProfile, today: Date): AiaResult {
    const risk = this.classify(profile);
    const obligations = this.getObligations(risk);
    const approvalRequired = this.requiresApproval(risk);
    const years = risk === 'high' ? 1 : 2;
    const next = new Date(today);
    next.setFullYear(next.getFullYear() + years);
    return {
      systemId: profile.id,
      useCase: profile.useCase,
      risk,
      obligations,
      approvalRequired,
      nextReviewDate: next.toISOString().slice(0, 10),
    };
  }
}

export const aiImpactAssessment = new AiImpactAssessment();
