// Design Ref: §AI 노인 학대 탐지기 — 위험 신호 가중 점수화 (사례관리 지원)
// Plan SC: FR-R588.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type AbuseType = 'physical' | 'emotional' | 'financial' | 'neglect' | 'abandonment';

export interface CaseObservation {
  caseId: string;
  observationDate: string;
  bruises: boolean;
  unexplainedInjury: boolean;
  malnutrition: boolean;
  hygieneIssue: boolean;
  withdrawn: boolean;
  fearOfCaregiver: boolean;
  unusualFinancialWithdrawals: boolean;
  isolationFromFamily: boolean;
  missedMedicalCare: boolean;
}

export interface AbuseRiskScore {
  caseId: string;
  score: number; // 0~100
  level: 'low' | 'moderate' | 'high' | 'severe';
  suspectedTypes: AbuseType[];
  nextAction: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AIElderAbuseDetector {
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  evaluate(obs: CaseObservation, grade: DataGrade = 'O'): AbuseRiskScore {
    blockClassifiedData(grade);

    let score = 0;
    const types = new Set<AbuseType>();

    if (obs.bruises) {
      score += 15;
      types.add('physical');
    }
    if (obs.unexplainedInjury) {
      score += 20;
      types.add('physical');
    }
    if (obs.malnutrition) {
      score += 15;
      types.add('neglect');
    }
    if (obs.hygieneIssue) {
      score += 10;
      types.add('neglect');
    }
    if (obs.withdrawn) {
      score += 8;
      types.add('emotional');
    }
    if (obs.fearOfCaregiver) {
      score += 15;
      types.add('emotional');
      types.add('physical');
    }
    if (obs.unusualFinancialWithdrawals) {
      score += 15;
      types.add('financial');
    }
    if (obs.isolationFromFamily) {
      score += 10;
      types.add('abandonment');
    }
    if (obs.missedMedicalCare) {
      score += 12;
      types.add('neglect');
    }
    score = Math.min(100, score);

    const level: AbuseRiskScore['level'] =
      score >= 70 ? 'severe' : score >= 45 ? 'high' : score >= 20 ? 'moderate' : 'low';

    const nextAction =
      level === 'severe'
        ? '즉시 노인보호전문기관 신고 및 현장 출동 요청'
        : level === 'high'
        ? '72시간 내 현장 방문 및 다학제 사례회의 개최'
        : level === 'moderate'
        ? '2주 내 재평가 및 가족 상담'
        : '정기 모니터링 유지';

    const result: AbuseRiskScore = {
      caseId: obs.caseId,
      score,
      level,
      suspectedTypes: [...types],
      nextAction,
    };
    this.log('EVALUATE', { caseId: obs.caseId, score, level });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
