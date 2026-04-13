// Design Ref: §공공 심리지원 — 재난 후 슬픔·트라우마 지원 매칭
// Plan SC: FR-R552.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type DisasterType = 'earthquake' | 'flood' | 'fire' | 'accident' | 'pandemic';
export type SupportType = 'counseling' | 'group_therapy' | 'medication' | 'community' | 'hotline';

export interface SupportCase {
  caseId: string;
  disasterType: DisasterType;
  severityScore: number; // 0~100 (subjective distress, anonymized)
  daysSinceIncident: number;
  hasFamilySupport: boolean;
  region: string;
}

export interface SupportPlan {
  caseId: string;
  urgencyLevel: 'routine' | 'priority' | 'urgent' | 'critical';
  recommendedSupports: SupportType[];
  followUpDays: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class PublicGriefSupportAI {
  private cases = new Map<string, SupportCase>();
  private plans = new Map<string, SupportPlan>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R552.1
  registerCase(c: SupportCase, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (c.severityScore < 0 || c.severityScore > 100) {
      throw new Error('스트레스 점수는 0~100 범위여야 합니다');
    }
    if (c.daysSinceIncident < 0) throw new Error('경과일은 0 이상이어야 합니다');
    this.cases.set(c.caseId, { ...c });
    this.append('REGISTER_CASE', { caseId: c.caseId, disaster: c.disasterType });
  }

  // Plan SC: FR-R552.2
  triage(caseId: string, grade: DataGrade = 'O'): SupportPlan {
    blockClassifiedData(grade);
    const c = this.cases.get(caseId);
    if (!c) throw new Error(`케이스 미등록: ${caseId}`);

    let urgencyLevel: SupportPlan['urgencyLevel'];
    if (c.severityScore >= 80) urgencyLevel = 'critical';
    else if (c.severityScore >= 60) urgencyLevel = 'urgent';
    else if (c.severityScore >= 40) urgencyLevel = 'priority';
    else urgencyLevel = 'routine';

    const recommended: SupportType[] = [];
    if (urgencyLevel === 'critical') {
      recommended.push('hotline', 'counseling');
      if (c.severityScore >= 90) recommended.push('medication');
    } else if (urgencyLevel === 'urgent') {
      recommended.push('counseling', 'group_therapy');
    } else if (urgencyLevel === 'priority') {
      recommended.push('group_therapy', 'community');
    } else {
      recommended.push('community');
    }
    if (!c.hasFamilySupport && !recommended.includes('community')) {
      recommended.push('community');
    }

    const followUpDays =
      urgencyLevel === 'critical' ? 1 : urgencyLevel === 'urgent' ? 3 : urgencyLevel === 'priority' ? 7 : 14;

    const plan: SupportPlan = { caseId, urgencyLevel, recommendedSupports: recommended, followUpDays };
    this.plans.set(caseId, plan);
    this.append('TRIAGE', { caseId, urgencyLevel });
    return plan;
  }

  // Plan SC: FR-R552.3
  getPlan(caseId: string): SupportPlan | undefined {
    const p = this.plans.get(caseId);
    return p ? { ...p, recommendedSupports: [...p.recommendedSupports] } : undefined;
  }

  // Plan SC: FR-R552.4
  statsByDisaster(): Record<DisasterType, number> {
    const result: Record<DisasterType, number> = {
      earthquake: 0,
      flood: 0,
      fire: 0,
      accident: 0,
      pandemic: 0,
    };
    for (const c of this.cases.values()) result[c.disasterType] += 1;
    return result;
  }

  // Plan SC: FR-R552.5
  listCasesByRegion(region: string): SupportCase[] {
    return Array.from(this.cases.values())
      .filter(c => c.region === region)
      .map(c => ({ ...c }));
  }

  // Plan SC: FR-R552.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
