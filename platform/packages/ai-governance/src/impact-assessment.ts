// Design Ref: MTU-N463 §impact-assessment
// Plan SC: FR-AIA.1 ~ FR-AIA.5
//
// AI 영향평가 (EU AI Act 기반 4단계 위험 분류 + 의무 체크리스트).
// 참고: Regulation (EU) 2024/1689 (AI Act) 및 과기정통부 AI 윤리기준.

export type AiPurpose =
  | 'recruitment'
  | 'education'
  | 'credit_scoring'
  | 'healthcare'
  | 'law_enforcement'
  | 'border_control'
  | 'justice'
  | 'essential_services'
  | 'biometric_identification'
  | 'social_scoring'
  | 'chatbot'
  | 'content_recommendation'
  | 'spam_filter'
  | 'video_game_ai';

export type RiskLevel = 'minimal' | 'limited' | 'high' | 'unacceptable';

export interface AiSystemInfo {
  id: string;
  name: string;
  purpose: AiPurpose;
  humanOversight: boolean;
  transparency: boolean;
  dataGovernance: boolean;
  logsRetained: boolean;
  affectedPopulation: number;
}

export interface AiaResult {
  systemId: string;
  riskLevel: RiskLevel;
  approved: boolean;
  mandatoryControls: string[];
  gaps: string[];
  nextReviewAt: string;
}

// EU AI Act 기반 위험 분류
const UNACCEPTABLE: AiPurpose[] = ['social_scoring'];
const HIGH_RISK: AiPurpose[] = [
  'recruitment',
  'education',
  'credit_scoring',
  'healthcare',
  'law_enforcement',
  'border_control',
  'justice',
  'essential_services',
  'biometric_identification',
];
const LIMITED_RISK: AiPurpose[] = ['chatbot', 'content_recommendation'];

// FR-AIA.2: 위험도 4단계
export function classifyRisk(purpose: AiPurpose): RiskLevel {
  if (UNACCEPTABLE.includes(purpose)) return 'unacceptable';
  if (HIGH_RISK.includes(purpose)) return 'high';
  if (LIMITED_RISK.includes(purpose)) return 'limited';
  return 'minimal';
}

// FR-AIA.3: 의무 체크리스트
export function mandatoryControls(risk: RiskLevel): string[] {
  const base = ['투명성 고지', '사용자 권리 안내'];
  switch (risk) {
    case 'unacceptable':
      return ['사용 금지'];
    case 'high':
      return [
        '위험 관리 시스템 (Art.9)',
        '데이터 거버넌스 (Art.10)',
        '기술 문서 유지 (Art.11)',
        '로그 보존 (Art.12)',
        '투명성·사용자 고지 (Art.13)',
        '인간 감독 (Art.14)',
        '정확성·견고성·사이버보안 (Art.15)',
        '적합성 평가 (Art.43)',
        '등록 (Art.49)',
      ];
    case 'limited':
      return [...base, 'AI 사용 사실 공개'];
    default:
      return base;
  }
}

// FR-AIA.1/4: 영향평가 + 배포 승인 게이트
export class AiImpactAssessor {
  assess(system: AiSystemInfo, now: Date = new Date()): AiaResult {
    const risk = classifyRisk(system.purpose);
    const controls = mandatoryControls(risk);
    const gaps: string[] = [];

    if (risk === 'high') {
      if (!system.humanOversight) gaps.push('human_oversight_missing');
      if (!system.transparency) gaps.push('transparency_missing');
      if (!system.dataGovernance) gaps.push('data_governance_missing');
      if (!system.logsRetained) gaps.push('log_retention_missing');
    }

    const approved = risk !== 'unacceptable' && gaps.length === 0;

    // FR-AIA.5: 재평가 주기 (high: 1년, 그 외: 3년)
    const nextReview = new Date(now);
    nextReview.setFullYear(
      nextReview.getFullYear() + (risk === 'high' ? 1 : 3),
    );

    return {
      systemId: system.id,
      riskLevel: risk,
      approved,
      mandatoryControls: controls,
      gaps,
      nextReviewAt: nextReview.toISOString(),
    };
  }
}
