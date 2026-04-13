// Design Ref: §청소년 정책 영향 — 다차원 효과 추정 모델
// Plan SC: FR-R522.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type PolicyDomain = 'education' | 'employment' | 'welfare' | 'mental_health' | 'culture';

export interface PolicyRegistration {
  policyId: string;
  title: string;
  domain: PolicyDomain;
  targetAgeMin: number;
  targetAgeMax: number;
  budgetKRW: number;
}

export interface OutcomeData {
  policyId: string;
  participantCount: number;
  satisfactionScore: number; // 0~100
  beforeIndicator: number;
  afterIndicator: number;
}

export interface ImpactResult {
  policyId: string;
  impactScore: number;
  effectivenessRate: number;
  costPerParticipant: number;
  grade: 'A' | 'B' | 'C' | 'D';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class YouthPolicyImpactAI {
  private policies = new Map<string, PolicyRegistration>();
  private outcomes = new Map<string, OutcomeData>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R522.1
  registerPolicy(reg: PolicyRegistration, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (reg.targetAgeMin < 9 || reg.targetAgeMax > 34 || reg.targetAgeMin > reg.targetAgeMax) {
      throw new Error('청소년/청년 대상 연령 범위가 올바르지 않습니다 (9~34)');
    }
    if (reg.budgetKRW < 0) throw new Error('예산은 0 이상이어야 합니다');
    this.policies.set(reg.policyId, { ...reg });
    this.append('REGISTER_POLICY', { policyId: reg.policyId, domain: reg.domain });
  }

  // Plan SC: FR-R522.2
  recordOutcome(data: OutcomeData, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.policies.has(data.policyId)) throw new Error(`정책 미등록: ${data.policyId}`);
    if (data.satisfactionScore < 0 || data.satisfactionScore > 100) {
      throw new Error('만족도 점수는 0~100 범위여야 합니다');
    }
    if (data.participantCount < 0) throw new Error('참여자 수는 0 이상이어야 합니다');
    this.outcomes.set(data.policyId, { ...data });
    this.append('RECORD_OUTCOME', { policyId: data.policyId, participantCount: data.participantCount });
  }

  // Plan SC: FR-R522.3
  evaluate(policyId: string, grade: DataGrade = 'O'): ImpactResult {
    blockClassifiedData(grade);
    const policy = this.policies.get(policyId);
    if (!policy) throw new Error(`정책 미등록: ${policyId}`);
    const outcome = this.outcomes.get(policyId);
    if (!outcome) throw new Error(`결과 데이터 없음: ${policyId}`);

    const delta = outcome.afterIndicator - outcome.beforeIndicator;
    const base = Math.abs(outcome.beforeIndicator) < 0.0001 ? 1 : Math.abs(outcome.beforeIndicator);
    const effectivenessRate = Math.round((delta / base) * 10000) / 100;

    const satisfactionWeight = outcome.satisfactionScore / 100;
    const impactScore = Math.round((effectivenessRate * 0.6 + satisfactionWeight * 40) * 100) / 100;

    const costPerParticipant =
      outcome.participantCount === 0 ? 0 : Math.round(policy.budgetKRW / outcome.participantCount);

    const resultGrade: 'A' | 'B' | 'C' | 'D' =
      impactScore >= 60 ? 'A' : impactScore >= 40 ? 'B' : impactScore >= 20 ? 'C' : 'D';

    const result: ImpactResult = {
      policyId,
      impactScore,
      effectivenessRate,
      costPerParticipant,
      grade: resultGrade,
    };
    this.append('EVALUATE', { policyId, impactScore, grade: resultGrade });
    return result;
  }

  // Plan SC: FR-R522.4
  listPolicies(domain?: PolicyDomain): PolicyRegistration[] {
    const all = Array.from(this.policies.values());
    return (domain ? all.filter(p => p.domain === domain) : all).map(p => ({ ...p }));
  }

  // Plan SC: FR-R522.5
  getOutcome(policyId: string): OutcomeData | undefined {
    const o = this.outcomes.get(policyId);
    return o ? { ...o } : undefined;
  }

  // Plan SC: FR-R522.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
