// Design Ref: MTU-N424 §AI 규제 준수 모니터링
// Plan SC: FR-N424.1~5

export type AIRiskLevel = 'unacceptable' | 'high' | 'limited' | 'minimal';

export interface AISystemProfile {
  systemId: string;
  name: string;
  purpose: string;
  usesPersonalData: boolean;
  affectsRights: boolean;
  inHighRiskDomain: boolean;
  usedBy: 'public' | 'business' | 'internal';
  autoDecisions: boolean;
}

export interface ControlCheck {
  controlId: string;
  name: string;
  required: boolean;
  implemented: boolean;
  evidence?: string;
}

export interface ComplianceReport {
  systemId: string;
  euAiActLevel: AIRiskLevel;
  koreanAiLawApplicable: boolean;
  requiredControls: ControlCheck[];
  passRate: number;
  gaps: string[];
  generatedAt: string;
}

export class AIRegulationCompliance {
  /** FR-N424.1 EU AI Act 등급 */
  classifyEuRisk(profile: AISystemProfile): AIRiskLevel {
    if (profile.name.toLowerCase().includes('social scoring')) return 'unacceptable';
    if (profile.inHighRiskDomain || (profile.affectsRights && profile.autoDecisions)) return 'high';
    if (profile.usedBy === 'public') return 'limited';
    return 'minimal';
  }

  /** FR-N424.2 국내 AI 기본법 매핑 */
  isKoreanAiLawApplicable(profile: AISystemProfile): boolean {
    return profile.usesPersonalData || profile.affectsRights || profile.inHighRiskDomain;
  }

  /** FR-N424.3 고위험 필수 통제 */
  getRequiredControls(level: AIRiskLevel): ControlCheck[] {
    const base: ControlCheck[] = [
      { controlId: 'C1', name: '데이터 거버넌스', required: true, implemented: false },
      { controlId: 'C2', name: '기술 문서화', required: true, implemented: false },
    ];
    if (level === 'high') {
      return [
        ...base,
        { controlId: 'C3', name: '로깅 시스템', required: true, implemented: false },
        { controlId: 'C4', name: '인간 감독', required: true, implemented: false },
        { controlId: 'C5', name: '정확성/견고성/보안', required: true, implemented: false },
        { controlId: 'C6', name: '위험 관리 체계', required: true, implemented: false },
        { controlId: 'C7', name: '적합성 평가', required: true, implemented: false },
      ];
    }
    if (level === 'limited') {
      return [
        ...base,
        { controlId: 'T1', name: '투명성 고지', required: true, implemented: false },
      ];
    }
    return base;
  }

  /** FR-N424.4 미준수 탐지 */
  findGaps(checks: ControlCheck[]): string[] {
    return checks
      .filter((c) => c.required && !c.implemented)
      .map((c) => `${c.controlId}: ${c.name}`);
  }

  /** FR-N424.5 리포트 생성 */
  generateReport(profile: AISystemProfile, evidence: Record<string, string>): ComplianceReport {
    const level = this.classifyEuRisk(profile);
    const required = this.getRequiredControls(level);
    const filled = required.map((c) => ({
      ...c,
      implemented: evidence[c.controlId] !== undefined,
      evidence: evidence[c.controlId],
    }));
    const passed = filled.filter((c) => c.implemented).length;
    const passRate = required.length > 0 ? +(passed / required.length).toFixed(2) : 1;
    return {
      systemId: profile.systemId,
      euAiActLevel: level,
      koreanAiLawApplicable: this.isKoreanAiLawApplicable(profile),
      requiredControls: filled,
      passRate,
      gaps: this.findGaps(filled),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const aiRegulationCompliance = new AIRegulationCompliance();
