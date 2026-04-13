// Design Ref: §마약 남용 예방 AI — 고위험군 스크리닝 및 개입 권고
// Plan SC: FR-R598.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface ScreeningInput {
  screeningId: string;
  ageGroup: 'teen' | 'young-adult' | 'adult' | 'senior';
  // 주관적 지표 (0~5)
  stressLevel: number;
  socialIsolation: number;
  peerInfluence: number;
  pastUse: number;
  mentalHealthScore: number;
  // 이벤트
  priorRehab: boolean;
  prescribedOpioid: boolean;
  familyHistory: boolean;
}

export type RiskTier = 'minimal' | 'low' | 'moderate' | 'high' | 'severe';

export interface PreventionPlan {
  screeningId: string;
  riskTier: RiskTier;
  riskScore: number;
  interventions: string[];
  urgentContact: boolean;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class DrugAbusePreventionAI {
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  screen(input: ScreeningInput, grade: DataGrade = 'O'): PreventionPlan {
    blockClassifiedData(grade);
    const indicators = [
      input.stressLevel,
      input.socialIsolation,
      input.peerInfluence,
      input.pastUse,
      input.mentalHealthScore,
    ];
    for (const v of indicators) {
      if (v < 0 || v > 5) throw new Error('지표 0~5 범위');
    }

    const weights = { stress: 1.5, iso: 1.5, peer: 2.0, past: 3.0, mental: 2.0 };
    let score =
      input.stressLevel * weights.stress +
      input.socialIsolation * weights.iso +
      input.peerInfluence * weights.peer +
      input.pastUse * weights.past +
      input.mentalHealthScore * weights.mental;

    // 이벤트 가중
    if (input.priorRehab) score += 10;
    if (input.prescribedOpioid) score += 5;
    if (input.familyHistory) score += 3;

    // 연령대 가중
    if (input.ageGroup === 'teen') score += 5;
    else if (input.ageGroup === 'young-adult') score += 3;

    score = Math.min(100, score);

    let tier: RiskTier;
    if (score >= 50) tier = 'severe';
    else if (score >= 35) tier = 'high';
    else if (score >= 20) tier = 'moderate';
    else if (score >= 10) tier = 'low';
    else tier = 'minimal';

    const interventions: string[] = [];
    if (tier === 'severe') {
      interventions.push('즉시 전문가 상담', '중독치유센터 연계', '가족 보호자 통보');
    } else if (tier === 'high') {
      interventions.push('정기 상담 (주 1회)', '약물 스크리닝 검사', '또래 지원 모임');
    } else if (tier === 'moderate') {
      interventions.push('월 1회 상담', '학교/직장 보건 연계');
    } else if (tier === 'low') {
      interventions.push('예방 교육 자료 제공');
    } else {
      interventions.push('정보 제공');
    }

    const urgentContact = tier === 'severe' || (tier === 'high' && input.pastUse >= 4);

    const result: PreventionPlan = {
      screeningId: input.screeningId,
      riskTier: tier,
      riskScore: score,
      interventions,
      urgentContact,
    };
    this.log('SCREEN', { screeningId: input.screeningId, tier });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
