// Design Ref: §노인 돌봄 코디네이터 — 다차원 필요도 기반 자원 매칭
// Plan SC: FR-R524.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type CareCategory = 'medical' | 'meal' | 'mobility' | 'companionship' | 'housework';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SeniorProfile {
  seniorId: string;
  age: number;
  livingAlone: boolean;
  chronicDiseaseCount: number;
  mobilityScore: number; // 0~100 (높을수록 자립적)
  region: string;
}

export interface CareProvider {
  providerId: string;
  categories: CareCategory[];
  region: string;
  capacity: number;
  currentLoad: number;
}

export interface CarePlan {
  seniorId: string;
  urgency: UrgencyLevel;
  recommendedCategories: CareCategory[];
  matchedProviders: string[];
  needScore: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AISeniorCareCoordinator {
  private seniors = new Map<string, SeniorProfile>();
  private providers = new Map<string, CareProvider>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R524.1
  registerSenior(profile: SeniorProfile, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (profile.age < 60) throw new Error('대상 연령은 60세 이상이어야 합니다');
    if (profile.mobilityScore < 0 || profile.mobilityScore > 100) {
      throw new Error('이동성 점수는 0~100 범위여야 합니다');
    }
    this.seniors.set(profile.seniorId, { ...profile });
    this.append('REGISTER_SENIOR', { seniorId: profile.seniorId, region: profile.region });
  }

  // Plan SC: FR-R524.2
  registerProvider(provider: CareProvider, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (provider.capacity <= 0) throw new Error('용량은 1 이상이어야 합니다');
    if (provider.currentLoad < 0) throw new Error('현재 부하는 0 이상이어야 합니다');
    this.providers.set(provider.providerId, { ...provider });
    this.append('REGISTER_PROVIDER', { providerId: provider.providerId });
  }

  // Plan SC: FR-R524.3
  createPlan(seniorId: string, grade: DataGrade = 'O'): CarePlan {
    blockClassifiedData(grade);
    const senior = this.seniors.get(seniorId);
    if (!senior) throw new Error(`어르신 미등록: ${seniorId}`);

    let needScore = 0;
    if (senior.age >= 80) needScore += 25;
    else if (senior.age >= 70) needScore += 15;
    else needScore += 5;

    if (senior.livingAlone) needScore += 20;
    needScore += Math.min(30, senior.chronicDiseaseCount * 10);
    needScore += Math.max(0, 30 - Math.floor(senior.mobilityScore * 0.3));

    const urgency: UrgencyLevel =
      needScore >= 80 ? 'critical' : needScore >= 60 ? 'high' : needScore >= 35 ? 'medium' : 'low';

    const recommendedCategories: CareCategory[] = [];
    if (senior.chronicDiseaseCount > 0) recommendedCategories.push('medical');
    if (senior.livingAlone) {
      recommendedCategories.push('meal');
      recommendedCategories.push('companionship');
    }
    if (senior.mobilityScore < 50) recommendedCategories.push('mobility');
    if (senior.age >= 75) recommendedCategories.push('housework');

    const matchedProviders = Array.from(this.providers.values())
      .filter(p => p.region === senior.region && p.currentLoad < p.capacity)
      .filter(p => recommendedCategories.some(cat => p.categories.includes(cat)))
      .sort((a, b) => a.currentLoad / a.capacity - b.currentLoad / b.capacity)
      .slice(0, 3)
      .map(p => p.providerId);

    const plan: CarePlan = {
      seniorId,
      urgency,
      recommendedCategories,
      matchedProviders,
      needScore,
    };
    this.append('CREATE_PLAN', { seniorId, urgency, needScore });
    return plan;
  }

  // Plan SC: FR-R524.4
  assignProvider(providerId: string): void {
    const p = this.providers.get(providerId);
    if (!p) throw new Error(`공급자 미등록: ${providerId}`);
    if (p.currentLoad >= p.capacity) throw new Error('용량 초과');
    p.currentLoad += 1;
    this.append('ASSIGN_PROVIDER', { providerId, newLoad: p.currentLoad });
  }

  // Plan SC: FR-R524.5
  listProviders(region?: string): CareProvider[] {
    const all = Array.from(this.providers.values());
    return (region ? all.filter(p => p.region === region) : all).map(p => ({
      ...p,
      categories: [...p.categories],
    }));
  }

  // Plan SC: FR-R524.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
