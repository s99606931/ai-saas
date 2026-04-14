// Design Ref: SVC-AI-ADV-R668.design.md — AI기반 민원인 역량 강화 v2
// Plan SC: FR-R668.1~5

import { createHash } from 'crypto';

export type LiteracyTier = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

interface AssessmentInput {
  citizenId: string;
  deviceUsage: number;
  onlineFreq: number;
  errorRate: number;
}
interface AssessmentResult {
  maskedCitizen: string;
  score: number;
  tier: LiteracyTier;
  recommendation: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const RECOMMENDATIONS: Record<LiteracyTier, string> = {
  BEGINNER: '대면 도움 + 기초 디지털 교육 과정',
  INTERMEDIATE: '온라인 자기학습 콘텐츠 + 챗봇 안내',
  ADVANCED: '셀프서비스 + 고급 행정 절차 안내',
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export class CitizenEmpowermentAIV2 {
  private auditLog: AuditEntry[] = [];

  assess(input: AssessmentInput, dataGrade?: string): AssessmentResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const d = clamp01(input.deviceUsage);
    const o = clamp01(input.onlineFreq);
    const e = clamp01(input.errorRate);
    const score = Math.round(100 * (0.4 * d + 0.4 * o + 0.2 * (1 - e)));

    let tier: LiteracyTier;
    if (score >= 80) tier = 'ADVANCED';
    else if (score >= 50) tier = 'INTERMEDIATE';
    else tier = 'BEGINNER';

    const result: AssessmentResult = {
      maskedCitizen: createHash('sha256').update(input.citizenId).digest('hex').substring(0, 16),
      score,
      tier,
      recommendation: RECOMMENDATIONS[tier],
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ASSESS_LITERACY',
      details: { score, tier },
    });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
