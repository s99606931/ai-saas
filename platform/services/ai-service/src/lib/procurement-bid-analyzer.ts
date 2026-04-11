// 공공조달 입찰 분석 -- FR-N299.1~FR-N299.6
// Design Ref: MTU-N299 DESIGN §1~§6
// Plan SC: SC-1 (요건추출 90%+), SC-2 (적격판단 85%+), SC-3 (분석시간 5분), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근통제, D-12 개발보안

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 입찰 공고 */
export interface BidNotice {
  readonly noticeId: string;
  readonly title: string;
  readonly agency: string;
  readonly bidType: 'general' | 'restricted' | 'negotiation' | 'turnkey';
  readonly estimatedAmount: number;
  readonly deadline: string;
  readonly requirements: string;
  readonly evaluationCriteria: string;
}

/** 추출된 요건 */
export interface ExtractedRequirement {
  readonly reqId: string;
  readonly category: 'technical' | 'qualification' | 'financial' | 'experience' | 'certification';
  readonly description: string;
  readonly mandatory: boolean;
  readonly weight: number;
}

/** 적격성 평가 */
export interface EligibilityAssessment {
  readonly assessmentId: string;
  readonly noticeId: string;
  readonly totalRequirements: number;
  readonly metRequirements: number;
  readonly eligibilityScore: number;
  readonly eligible: boolean;
  readonly gaps: string[];
  readonly strengths: string[];
}

/** 입찰 전략 */
export interface BidStrategy {
  readonly strategyId: string;
  readonly noticeId: string;
  readonly recommendedApproach: 'aggressive' | 'balanced' | 'conservative' | 'skip';
  readonly priceStrategy: string;
  readonly technicalFocus: string[];
  readonly winProbability: number;
  readonly reasoning: string;
}

/** 입찰 이력 */
export interface BidHistory {
  readonly historyId: string;
  readonly tenantId: string;
  readonly noticeId: string;
  readonly bidAmount: number;
  readonly result: 'won' | 'lost' | 'cancelled' | 'pending';
  readonly score: number;
  readonly date: string;
}

/** 감사 로그 */
export interface BidAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: BidAuditEntry[] = [];

function recordAudit(entry: Omit<BidAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getBidAuditLog(tenantId: string): readonly BidAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 요건 추출 ────────────────────────────────────────────────────────────────

const REQUIREMENT_KEYWORDS: Record<ExtractedRequirement['category'], string[]> = {
  technical: ['기술력', '개발 경험', '프레임워크', '아키텍처', '성능', '보안'],
  qualification: ['자격', '면허', '등록', '인증', '자격증'],
  financial: ['자본금', '매출액', '신용등급', '재무', '보증'],
  experience: ['실적', '수행 경험', '납품', '구축 실적', '유지보수'],
  certification: ['인증서', 'ISO', 'ISMS', 'CSAP', 'CC인증'],
};

/** 입찰 공고 요건 추출 -- FR-N299.1 */
export function extractRequirements(notice: BidNotice): ExtractedRequirement[] {
  const requirements: ExtractedRequirement[] = [];
  const text = `${notice.requirements} ${notice.evaluationCriteria}`;
  const sentences = text.split(/[.。,]\s*/).filter(s => s.trim().length > 3);

  for (const sentence of sentences) {
    for (const [category, keywords] of Object.entries(REQUIREMENT_KEYWORDS)) {
      const matchedKw = keywords.find(kw => sentence.includes(kw));
      if (matchedKw) {
        requirements.push({
          reqId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: category as ExtractedRequirement['category'],
          description: sentence.trim().slice(0, 200),
          mandatory: sentence.includes('필수') || sentence.includes('반드시') || sentence.includes('의무'),
          weight: sentence.includes('필수') ? 20 : 10,
        });
        break;
      }
    }
  }

  return requirements;
}

// -- 적격성 평가 ──────────────────────────────────────────────────────────────

/** 자사 역량 */
export interface CompanyCapability {
  readonly certifications: string[];
  readonly annualRevenue: number;
  readonly employees: number;
  readonly experiences: string[];
  readonly techStack: string[];
}

/** 적격성 자동 평가 -- FR-N299.2 */
export function assessEligibility(
  tenantId: string,
  notice: BidNotice,
  requirements: ExtractedRequirement[],
  capability: CompanyCapability,
): EligibilityAssessment {
  const gaps: string[] = [];
  const strengths: string[] = [];
  let metCount = 0;

  for (const req of requirements) {
    let met = false;

    if (req.category === 'certification') {
      met = capability.certifications.some(c =>
        req.description.includes(c),
      );
    } else if (req.category === 'experience') {
      met = capability.experiences.some(e =>
        req.description.includes(e) || e.includes(req.description.slice(0, 20)),
      );
    } else if (req.category === 'financial') {
      met = capability.annualRevenue > notice.estimatedAmount * 0.1;
    } else if (req.category === 'technical') {
      met = capability.techStack.some(t => req.description.includes(t));
    } else {
      met = true; // 자격 요건은 기본 충족으로 가정
    }

    if (met) {
      metCount++;
      strengths.push(req.description.slice(0, 50));
    } else {
      gaps.push(req.description.slice(0, 50));
    }
  }

  const eligibilityScore = requirements.length > 0 ? (metCount / requirements.length) * 100 : 0;
  const mandatoryMet = requirements
    .filter(r => r.mandatory)
    .every(r => {
      if (r.category === 'certification') {
        return capability.certifications.some(c => r.description.includes(c));
      }
      return true;
    });

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'BID_ELIGIBILITY_ASSESSED',
    target: notice.noticeId,
    details: { eligibilityScore, metCount, totalRequirements: requirements.length },
  });

  return {
    assessmentId: `assess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    noticeId: notice.noticeId,
    totalRequirements: requirements.length,
    metRequirements: metCount,
    eligibilityScore,
    eligible: mandatoryMet && eligibilityScore >= 60,
    gaps,
    strengths,
  };
}

// -- 입찰 전략 ────────────────────────────────────────────────────────────────

/** 입찰 전략 제안 -- FR-N299.4 */
export function suggestBidStrategy(
  notice: BidNotice,
  assessment: EligibilityAssessment,
): BidStrategy {
  let approach: BidStrategy['recommendedApproach'] = 'skip';
  let priceStrategy = '미입찰 권장';
  let winProbability = 0;
  let reasoning = '';

  if (!assessment.eligible) {
    approach = 'skip';
    reasoning = `필수 요건 미충족 (적격 점수: ${assessment.eligibilityScore.toFixed(0)}%)`;
  } else if (assessment.eligibilityScore >= 90) {
    approach = 'aggressive';
    priceStrategy = '경쟁력 있는 가격 제시 (예정가격의 88~92%)';
    winProbability = 0.7;
    reasoning = '높은 적격도 기반 공격적 입찰 권장';
  } else if (assessment.eligibilityScore >= 70) {
    approach = 'balanced';
    priceStrategy = '중간 수준 가격 제시 (예정가격의 90~95%)';
    winProbability = 0.4;
    reasoning = '기술 차별화 중심 전략 권장';
  } else {
    approach = 'conservative';
    priceStrategy = '보수적 가격 제시 (예정가격의 93~97%)';
    winProbability = 0.2;
    reasoning = '약점 보완 전략 필요, 기술 제안서 집중';
  }

  const technicalFocus = assessment.strengths.slice(0, 3);

  return {
    strategyId: `strat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    noticeId: notice.noticeId,
    recommendedApproach: approach,
    priceStrategy,
    technicalFocus,
    winProbability,
    reasoning,
  };
}

// -- 이력 관리 ────────────────────────────────────────────────────────────────

const historyStore: Map<string, BidHistory[]> = new Map();

/** 입찰 이력 기록 -- FR-N299.5 */
export function recordBidHistory(tenantId: string, history: Omit<BidHistory, 'historyId' | 'tenantId'>): BidHistory {
  const entry: BidHistory = {
    ...history,
    historyId: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
  };

  const existing = historyStore.get(tenantId) ?? [];
  existing.push(entry);
  historyStore.set(tenantId, existing);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'BID_HISTORY_RECORDED',
    target: entry.historyId,
    details: { noticeId: history.noticeId, result: history.result },
  });

  return entry;
}

/** 입찰 이력 조회 */
export function getBidHistory(tenantId: string): readonly BidHistory[] {
  return historyStore.get(tenantId) ?? [];
}

/** 공공조달 입찰 분석 서비스 */
export class ProcurementBidAnalyzerService {
  constructor(private readonly tenantId: string) {}

  extractRequirements(notice: BidNotice): ExtractedRequirement[] {
    return extractRequirements(notice);
  }

  assessEligibility(notice: BidNotice, reqs: ExtractedRequirement[], cap: CompanyCapability): EligibilityAssessment {
    return assessEligibility(this.tenantId, notice, reqs, cap);
  }

  suggestStrategy(notice: BidNotice, assessment: EligibilityAssessment): BidStrategy {
    return suggestBidStrategy(notice, assessment);
  }

  recordHistory(history: Omit<BidHistory, 'historyId' | 'tenantId'>): BidHistory {
    return recordBidHistory(this.tenantId, history);
  }

  getHistory(): readonly BidHistory[] {
    return getBidHistory(this.tenantId);
  }

  getAuditLog(): readonly BidAuditEntry[] {
    return getBidAuditLog(this.tenantId);
  }
}
