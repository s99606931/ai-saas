// SVC-AI-ADV-R486 AI Elderly Care Service
// Design Ref: SVC-AI-ADV-R486.design.md §노인돌봄
// Plan SC: FR-486.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface ElderlyProfile {
  readonly recipientId: string;
  readonly ageYears: number;
  readonly livesAlone: boolean;
  readonly dailyActivityScore: number;
  readonly cognitiveScore: number;
  readonly chronicDiseaseCount: number;
  readonly mobility: 'INDEPENDENT' | 'ASSISTED' | 'BEDRIDDEN';
}

export interface CarePlan {
  readonly recipientId: string;
  readonly tier: 'LIGHT' | 'STANDARD' | 'INTENSIVE' | 'CRITICAL';
  readonly visitsPerWeek: number;
  readonly services: readonly string[];
  readonly emergencyMonitoring: boolean;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 노인 데이터 차단 (N2SF N-05)`);
  }
}

export class AiElderlyCareService {
  private readonly auditLog: AuditEntry[] = [];

  recommend(profile: ElderlyProfile, grade: DataGrade = 'O'): CarePlan {
    block(grade);

    let score = 0;
    if (profile.ageYears >= 80) score += 20;
    else if (profile.ageYears >= 70) score += 10;

    if (profile.livesAlone) score += 15;
    if (profile.dailyActivityScore < 50) score += 20;
    if (profile.cognitiveScore < 50) score += 25;
    score += profile.chronicDiseaseCount * 5;
    if (profile.mobility === 'BEDRIDDEN') score += 30;
    else if (profile.mobility === 'ASSISTED') score += 15;

    const tier: CarePlan['tier'] =
      score >= 80 ? 'CRITICAL' : score >= 55 ? 'INTENSIVE' : score >= 30 ? 'STANDARD' : 'LIGHT';

    const services: string[] = ['health_check'];
    if (profile.livesAlone) services.push('safety_call');
    if (profile.cognitiveScore < 60) services.push('dementia_screening');
    if (profile.mobility !== 'INDEPENDENT') services.push('mobility_assist');
    if (profile.chronicDiseaseCount >= 2) services.push('medication_management');

    const visitsPerWeek =
      tier === 'CRITICAL' ? 7 : tier === 'INTENSIVE' ? 5 : tier === 'STANDARD' ? 3 : 1;

    const emergencyMonitoring = tier === 'CRITICAL' || tier === 'INTENSIVE';

    this.appendAudit('CARE_PLAN', {
      recipientId: profile.recipientId,
      tier,
      score,
    });

    return {
      recipientId: profile.recipientId,
      tier,
      visitsPerWeek,
      services,
      emergencyMonitoring,
    };
  }

  weeklyResourceLoad(profiles: readonly ElderlyProfile[]): number {
    const plans = profiles.map((p) => this.recommend(p));
    const totalVisits = plans.reduce((acc, p) => acc + p.visitsPerWeek, 0);
    this.appendAudit('LOAD', { recipients: profiles.length, totalVisits });
    return totalVisits;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  }
}
