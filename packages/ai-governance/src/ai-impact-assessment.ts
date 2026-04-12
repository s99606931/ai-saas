/**
 * AI 영향 평가 자동화 (고위험 AI 식별)
 * Design Ref: MTU-N463 §3
 * Plan SC: FR-AIA.1~5
 */

import { z } from 'zod';

export const AiSystemSchema = z.object({
  systemId: z.string().min(1),
  name: z.string().min(1),
  useCase: z.string().min(1),
  deployed: z.boolean(),
  affectedSubjects: z.number().int().nonnegative(),
  automatedDecision: z.boolean(),
  humanInLoop: z.boolean(),
});

export type AiSystem = z.infer<typeof AiSystemSchema>;

export type AiRiskLevel = 'minimal' | 'limited' | 'high' | 'unacceptable';

/**
 * 고위험 용도 분류 (FR-AIA.1, FR-AIA.2)
 * EU AI Act Annex III 기반
 */
const HIGH_RISK_USE_CASES: Set<string> = new Set([
  'biometric-identification',
  'critical-infrastructure',
  'education-assessment',
  'employment-recruitment',
  'essential-services',
  'law-enforcement',
  'migration-asylum',
  'justice-administration',
]);

const UNACCEPTABLE_USE_CASES: Set<string> = new Set([
  'social-scoring',
  'subliminal-manipulation',
  'realtime-biometric-public',
]);

export class AiRiskClassifier {
  classify(system: AiSystem): {
    level: AiRiskLevel;
    reasons: string[];
  } {
    const validated = AiSystemSchema.parse(system);
    const reasons: string[] = [];

    if (UNACCEPTABLE_USE_CASES.has(validated.useCase)) {
      reasons.push(`금지 용도: ${validated.useCase}`);
      return { level: 'unacceptable', reasons };
    }

    if (HIGH_RISK_USE_CASES.has(validated.useCase)) {
      reasons.push(`고위험 용도: ${validated.useCase}`);
    }
    if (validated.affectedSubjects >= 100000) {
      reasons.push('10만 명 이상 영향');
    }
    if (validated.automatedDecision && !validated.humanInLoop) {
      reasons.push('인간 감독 없는 자동화 결정');
    }

    if (reasons.length >= 2) return { level: 'high', reasons };
    if (reasons.length === 1) return { level: 'limited', reasons };
    return { level: 'minimal', reasons };
  }
}

/**
 * 의무 체크리스트 (FR-AIA.3, FR-AIA.4)
 */
export interface ObligationCheck {
  code: string;
  description: string;
  required: boolean;
  met: boolean;
}

export class AiaObligationChecker {
  check(
    level: AiRiskLevel,
    implemented: Set<string>,
  ): { obligations: ObligationCheck[]; approved: boolean } {
    const all: ObligationCheck[] = [
      { code: 'AIA-DOC', description: '기술 문서화', required: level === 'high', met: implemented.has('AIA-DOC') },
      { code: 'AIA-RMS', description: '리스크 관리 시스템', required: level === 'high', met: implemented.has('AIA-RMS') },
      { code: 'AIA-DATA-QUALITY', description: '학습 데이터 품질', required: level === 'high', met: implemented.has('AIA-DATA-QUALITY') },
      { code: 'AIA-LOGGING', description: '자동 로깅', required: level === 'high', met: implemented.has('AIA-LOGGING') },
      { code: 'AIA-HUMAN-OVERSIGHT', description: '인간 감독', required: level === 'high', met: implemented.has('AIA-HUMAN-OVERSIGHT') },
      { code: 'AIA-ACCURACY', description: '정확성·견고성', required: level === 'high', met: implemented.has('AIA-ACCURACY') },
      { code: 'AIA-TRANSPARENCY', description: '투명성', required: level !== 'minimal', met: implemented.has('AIA-TRANSPARENCY') },
    ];
    const failed = all.filter((o) => o.required && !o.met);
    return { obligations: all, approved: failed.length === 0 };
  }
}

/**
 * 주기적 재평가 (FR-AIA.5)
 */
export class AiaReviewScheduler {
  nextReviewDate(level: AiRiskLevel, lastReviewed: Date): Date {
    const next = new Date(lastReviewed);
    const months = level === 'high' ? 6 : level === 'limited' ? 12 : 24;
    next.setMonth(next.getMonth() + months);
    return next;
  }
}
