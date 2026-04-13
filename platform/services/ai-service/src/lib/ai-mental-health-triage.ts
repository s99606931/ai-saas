// Design Ref: §정신건강 트리아지 — PHQ/GAD 유사 지표 기반 긴급도 분류
// Plan SC: FR-R569.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface TriageInput {
  caseRef: string; // 익명 참조
  depressionScore: number; // 0~27 (PHQ-9 유사)
  anxietyScore: number; // 0~21 (GAD-7 유사)
  sleepIssueScore: number; // 0~10
  suicidalIdeation: 0 | 1 | 2 | 3; // 0 없음 ~ 3 계획 있음
  functionalImpairment: 0 | 1 | 2 | 3;
  supportSystemScore: number; // 0~10 (높을수록 좋음)
}

export interface TriageResult {
  caseRef: string;
  urgency: 'routine' | 'priority' | 'urgent' | 'emergency';
  compositeScore: number;
  immediateActions: string[];
  referralLevel: 'self-help' | 'counseling' | 'psychiatric' | 'hospitalization';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class MentalHealthTriageAI {
  private readonly cases = new Map<string, TriageInput>();
  private readonly results: TriageResult[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  private validate(input: TriageInput): void {
    if (!input.caseRef || input.caseRef.length < 3) {
      throw new Error('케이스 참조가 유효하지 않습니다');
    }
    if (input.depressionScore < 0 || input.depressionScore > 27) {
      throw new Error('우울 점수는 0~27 범위여야 합니다');
    }
    if (input.anxietyScore < 0 || input.anxietyScore > 21) {
      throw new Error('불안 점수는 0~21 범위여야 합니다');
    }
    if (input.sleepIssueScore < 0 || input.sleepIssueScore > 10) {
      throw new Error('수면 점수는 0~10 범위여야 합니다');
    }
    if (input.supportSystemScore < 0 || input.supportSystemScore > 10) {
      throw new Error('지지체계 점수는 0~10 범위여야 합니다');
    }
  }

  // Plan SC: FR-R569.1
  submit(input: TriageInput, grade: DataGrade = 'O'): TriageResult {
    blockClassifiedData(grade);
    this.validate(input);
    this.cases.set(input.caseRef, { ...input });

    // Plan SC: FR-R569.2 — 종합 점수 산출
    let score = 0;
    score += input.depressionScore * 1.2;
    score += input.anxietyScore * 1.2;
    score += input.sleepIssueScore * 1.0;
    score += input.functionalImpairment * 5;
    score += input.suicidalIdeation * 15;
    score -= input.supportSystemScore * 0.8;
    score = Math.max(0, Math.round(score * 100) / 100);

    // Plan SC: FR-R569.3 — 긴급도 분류
    let urgency: TriageResult['urgency'];
    if (input.suicidalIdeation >= 3 || score >= 80) {
      urgency = 'emergency';
    } else if (input.suicidalIdeation >= 2 || score >= 55) {
      urgency = 'urgent';
    } else if (score >= 30) {
      urgency = 'priority';
    } else {
      urgency = 'routine';
    }

    // Plan SC: FR-R569.4 — 의뢰 수준
    const referral: TriageResult['referralLevel'] =
      urgency === 'emergency' ? 'hospitalization'
        : urgency === 'urgent' ? 'psychiatric'
          : urgency === 'priority' ? 'counseling'
            : 'self-help';

    const actions: string[] = [];
    if (urgency === 'emergency') {
      actions.push('즉시 응급 개입');
      actions.push('24시간 위기상담 연결');
      actions.push('보호자/법적 후견인 통지');
    }
    if (urgency === 'urgent') {
      actions.push('48시간 내 정신과 연계');
      actions.push('안전 계획 수립');
    }
    if (urgency === 'priority') {
      actions.push('2주 내 상담 예약');
    }
    if (input.supportSystemScore < 3) {
      actions.push('사회적 지지체계 강화');
    }

    const result: TriageResult = {
      caseRef: input.caseRef,
      urgency,
      compositeScore: score,
      immediateActions: actions,
      referralLevel: referral,
    };
    this.results.push(result);
    this.append('TRIAGE', { caseRef: input.caseRef, urgency });
    return result;
  }

  // Plan SC: FR-R569.5
  listByUrgency(urgency: TriageResult['urgency']): TriageResult[] {
    return this.results.filter(r => r.urgency === urgency);
  }

  summarize(): Record<TriageResult['urgency'], number> {
    const s: Record<TriageResult['urgency'], number> = {
      routine: 0, priority: 0, urgent: 0, emergency: 0,
    };
    for (const r of this.results) s[r.urgency] += 1;
    return s;
  }

  // Plan SC: FR-R569.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
