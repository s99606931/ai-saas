// Design Ref: §핵심 알고리즘 — 문화재 위험 평가 및 보존 우선순위 산출
// Plan SC: FR-R520.1~5

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

type HeritageType = 'building' | 'sculpture' | 'document' | 'site' | 'artifact';
type HeritageGrade = 'national' | 'provincial' | 'local';

interface HeritageItem {
  itemId: string;
  name: string;
  type: HeritageType;
  grade: HeritageGrade;
  ageYears: number;
  conditionScore: number; // 0 ~ 100, 높을수록 양호
  environmentalRisk: number; // 0 ~ 100
  visitorPressure: number; // 0 ~ 100
}

interface RiskAssessment {
  itemId: string;
  riskScore: number; // 0 ~ 100
  priority: 'urgent' | 'high' | 'medium' | 'low';
  recommendation: string;
}

interface ConservationPlan {
  itemId: string;
  actions: string[];
  estimatedCostKrw: number;
  estimatedDurationDays: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const GRADE_WEIGHT: Record<HeritageGrade, number> = {
  national: 1.0,
  provincial: 0.7,
  local: 0.5,
};

export class CulturalHeritageProtectionAI {
  private items = new Map<string, HeritageItem>();
  private readonly auditLog: AuditEntry[] = [];

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R520.1
  registerItem(item: HeritageItem, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (item.conditionScore < 0 || item.conditionScore > 100) throw new Error('conditionScore 0~100');
    this.items.set(item.itemId, item);
    this.appendAudit('REGISTER_ITEM', { itemId: item.itemId, type: item.type, grade: item.grade });
  }

  // Plan SC: FR-R520.2
  assessRisk(itemId: string): RiskAssessment {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`문화재 미등록: ${itemId}`);

    const conditionRisk = 100 - item.conditionScore;
    const ageRisk = Math.min(100, item.ageYears / 10);
    const baseScore = (conditionRisk * 0.4) + (item.environmentalRisk * 0.3) + (item.visitorPressure * 0.2) + (ageRisk * 0.1);
    const weight = GRADE_WEIGHT[item.grade];
    const adjusted = Math.round(baseScore * (0.7 + weight * 0.3));
    const score = Math.max(0, Math.min(100, adjusted));

    let priority: RiskAssessment['priority'];
    let recommendation: string;
    if (score >= 75) {
      priority = 'urgent';
      recommendation = '긴급 보존 조치 및 출입 제한';
    } else if (score >= 55) {
      priority = 'high';
      recommendation = '단기 보존 계획 수립';
    } else if (score >= 30) {
      priority = 'medium';
      recommendation = '정기 모니터링 및 예방 보존';
    } else {
      priority = 'low';
      recommendation = '연 1회 점검';
    }

    this.appendAudit('ASSESS_RISK', { itemId, score, priority });
    return { itemId, riskScore: score, priority, recommendation };
  }

  // Plan SC: FR-R520.3
  generateConservationPlan(itemId: string): ConservationPlan {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`문화재 미등록: ${itemId}`);
    const assessment = this.assessRisk(itemId);

    const actions: string[] = [];
    let estimatedCostKrw = 0;
    let estimatedDurationDays = 0;

    if (item.conditionScore < 50) {
      actions.push('전문가 정밀 진단');
      estimatedCostKrw += 5000000;
      estimatedDurationDays += 14;
    }
    if (item.environmentalRisk >= 60) {
      actions.push('환경 제어 시설 설치');
      estimatedCostKrw += 20000000;
      estimatedDurationDays += 30;
    }
    if (item.visitorPressure >= 70) {
      actions.push('관람 동선 재설계 및 인원 제한');
      estimatedCostKrw += 8000000;
      estimatedDurationDays += 7;
    }
    if (assessment.priority === 'urgent' || assessment.priority === 'high') {
      actions.push('보존 처리 작업');
      estimatedCostKrw += 30000000;
      estimatedDurationDays += 60;
    }
    if (actions.length === 0) {
      actions.push('정기 점검 및 환경 모니터링');
      estimatedCostKrw = 1000000;
      estimatedDurationDays = 3;
    }

    this.appendAudit('GENERATE_PLAN', { itemId, actionCount: actions.length, estimatedCostKrw });
    return { itemId, actions, estimatedCostKrw, estimatedDurationDays };
  }

  // Plan SC: FR-R520.4
  prioritizeBatch(): RiskAssessment[] {
    const results: RiskAssessment[] = [];
    for (const item of this.items.values()) {
      results.push(this.assessRisk(item.itemId));
    }
    return results.sort((a, b) => b.riskScore - a.riskScore);
  }

  // Plan SC: FR-R520.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
