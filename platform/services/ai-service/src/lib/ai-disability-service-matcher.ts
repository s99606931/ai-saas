// Design Ref: §AI 장애인 서비스 매칭 — 필요 서비스 유형·자격 기반 매칭
// Plan SC: FR-R539.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type DisabilityType = 'mobility' | 'visual' | 'hearing' | 'intellectual' | 'developmental' | 'mental';
export type SeverityGrade = 'mild' | 'moderate' | 'severe';

export interface Applicant {
  applicantId: string; // 익명화 ID
  disabilityType: DisabilityType;
  severity: SeverityGrade;
  incomeLevel: 1 | 2 | 3 | 4 | 5; // 1=최저
  region: string;
  ageGroup: 'child' | 'youth' | 'adult' | 'senior';
}

export interface Service {
  serviceId: string;
  name: string;
  eligibleTypes: DisabilityType[];
  minSeverity: SeverityGrade;
  maxIncomeLevel: 1 | 2 | 3 | 4 | 5;
  region: string;
  ageGroups: Array<'child' | 'youth' | 'adult' | 'senior'>;
  capacity: number;
}

export interface MatchResult {
  serviceId: string;
  score: number;
  reason: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const SEVERITY_ORDER: Record<SeverityGrade, number> = { mild: 1, moderate: 2, severe: 3 };

export class AIDisabilityServiceMatcher {
  private readonly applicants = new Map<string, Applicant>();
  private readonly services = new Map<string, Service>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R539.1
  registerApplicant(applicant: Applicant, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    this.applicants.set(applicant.applicantId, { ...applicant });
    this.append('REGISTER_APPLICANT', { applicantId: applicant.applicantId });
  }

  // Plan SC: FR-R539.2
  registerService(service: Service, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (service.eligibleTypes.length === 0) throw new Error('자격 유형이 비어 있습니다');
    if (service.capacity <= 0) throw new Error('수용 정원은 양수여야 합니다');
    this.services.set(service.serviceId, {
      ...service,
      eligibleTypes: [...service.eligibleTypes],
      ageGroups: [...service.ageGroups],
    });
    this.append('REGISTER_SERVICE', { serviceId: service.serviceId });
  }

  // Plan SC: FR-R539.3
  match(applicantId: string): MatchResult[] {
    const applicant = this.applicants.get(applicantId);
    if (!applicant) throw new Error(`신청자 미등록: ${applicantId}`);

    const results: MatchResult[] = [];
    for (const service of this.services.values()) {
      if (!service.eligibleTypes.includes(applicant.disabilityType)) continue;
      if (SEVERITY_ORDER[applicant.severity] < SEVERITY_ORDER[service.minSeverity]) continue;
      if (applicant.incomeLevel > service.maxIncomeLevel) continue;
      if (!service.ageGroups.includes(applicant.ageGroup)) continue;

      const reason: string[] = ['type-ok', 'severity-ok', 'income-ok', 'age-ok'];
      let score = 50;
      if (service.region === applicant.region) {
        score += 30;
        reason.push('region-match');
      }
      if (applicant.incomeLevel <= 2) {
        score += 20;
        reason.push('low-income-priority');
      }
      results.push({ serviceId: service.serviceId, score, reason });
    }

    results.sort((a, b) => b.score - a.score);
    this.append('MATCH', { applicantId, count: results.length });
    return results;
  }

  // Plan SC: FR-R539.4
  countServicesByType(type: DisabilityType): number {
    return Array.from(this.services.values()).filter(s => s.eligibleTypes.includes(type)).length;
  }

  // Plan SC: FR-R539.5
  listServicesByRegion(region: string): Service[] {
    return Array.from(this.services.values()).filter(s => s.region === region).map(s => ({
      ...s,
      eligibleTypes: [...s.eligibleTypes],
      ageGroups: [...s.ageGroups],
    }));
  }

  // Plan SC: FR-R539.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
