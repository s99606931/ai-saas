/**
 * 개인정보영향평가(PIA) 자동화
 * Design Ref: MTU-N456 §3
 * Plan SC: FR-PIA.1~5
 */

import { z } from 'zod';

export const ProcessingActivitySchema = z.object({
  activityId: z.string().min(1),
  systemName: z.string().min(1),
  dataCategories: z.array(z.string()).min(1),
  subjectCount: z.number().int().nonnegative(),
  retentionDays: z.number().int().nonnegative(),
  crossBorder: z.boolean(),
  sensitiveData: z.boolean(),
  childrenData: z.boolean(),
  automatedDecision: z.boolean(),
});

export type ProcessingActivity = z.infer<typeof ProcessingActivitySchema>;

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFinding {
  code: string;
  description: string;
  level: RiskLevel;
  mitigation: string;
}

/**
 * 위험도 산정 엔진 (FR-PIA.1, FR-PIA.3)
 */
export class PiaRiskAssessor {
  assess(activity: ProcessingActivity): {
    overallLevel: RiskLevel;
    score: number;
    findings: RiskFinding[];
  } {
    const validated = ProcessingActivitySchema.parse(activity);
    const findings: RiskFinding[] = [];
    let score = 0;

    if (validated.subjectCount >= 50000) {
      findings.push({
        code: 'PIA-R01',
        description: '5만 명 이상 대규모 처리 (PIA 의무 대상)',
        level: 'HIGH',
        mitigation: '정기 PIA 수행 및 보호대책 수립',
      });
      score += 30;
    }
    if (validated.sensitiveData) {
      findings.push({
        code: 'PIA-R02',
        description: '민감정보 처리 (건강·생체·사상 등)',
        level: 'CRITICAL',
        mitigation: 'AES-256 암호화 + 접근 통제 강화',
      });
      score += 40;
    }
    if (validated.childrenData) {
      findings.push({
        code: 'PIA-R03',
        description: '만 14세 미만 아동 정보',
        level: 'HIGH',
        mitigation: '법정대리인 동의 필수',
      });
      score += 25;
    }
    if (validated.crossBorder) {
      findings.push({
        code: 'PIA-R04',
        description: '국외 이전 처리',
        level: 'HIGH',
        mitigation: '이전 계약서 + 별도 동의',
      });
      score += 20;
    }
    if (validated.automatedDecision) {
      findings.push({
        code: 'PIA-R05',
        description: '자동화된 의사결정 (프로파일링)',
        level: 'MEDIUM',
        mitigation: '거부권 안내 + 설명 가능성',
      });
      score += 15;
    }
    if (validated.retentionDays > 365 * 3) {
      findings.push({
        code: 'PIA-R06',
        description: '장기 보관 (3년 초과)',
        level: 'MEDIUM',
        mitigation: '보관 근거 명시, 주기적 파기',
      });
      score += 10;
    }

    let overallLevel: RiskLevel = 'LOW';
    if (score >= 60) overallLevel = 'CRITICAL';
    else if (score >= 40) overallLevel = 'HIGH';
    else if (score >= 20) overallLevel = 'MEDIUM';

    return { overallLevel, score, findings };
  }
}

/**
 * 법적 근거 매핑 (FR-PIA.2)
 */
export const LEGAL_BASIS_MAP: Record<string, string[]> = {
  '민원처리': ['개인정보보호법 §15①2 (법령상 의무)'],
  '인사관리': ['개인정보보호법 §15①4 (계약 이행)'],
  '마케팅': ['개인정보보호법 §15①1 (정보주체 동의)'],
  '보안로그': ['개인정보보호법 §15①6 (정당한 이익)'],
};

/**
 * PIA 보고서 생성기 (FR-PIA.4, FR-PIA.5)
 */
export class PiaReportGenerator {
  generate(activity: ProcessingActivity, purpose: string): {
    activity: ProcessingActivity;
    assessment: ReturnType<PiaRiskAssessor['assess']>;
    legalBasis: string[];
    nextReviewDate: string;
  } {
    const assessor = new PiaRiskAssessor();
    const assessment = assessor.assess(activity);
    const legalBasis = LEGAL_BASIS_MAP[purpose] ?? ['미분류 — 개별 검토 필요'];

    // 3년 후 재평가
    const nextReview = new Date();
    nextReview.setFullYear(nextReview.getFullYear() + 3);

    return {
      activity,
      assessment,
      legalBasis,
      nextReviewDate: nextReview.toISOString().slice(0, 10),
    };
  }
}
