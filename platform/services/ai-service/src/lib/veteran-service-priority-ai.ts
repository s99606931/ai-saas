// Design Ref: §보훈 서비스 우선순위 AI — 공적·장애·연령 가중 스코어
// Plan SC: FR-R579.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type VeteranCategory =
  | 'independence'
  | 'national_merit'
  | 'disabled_combat'
  | 'korean_war'
  | 'vietnam_war'
  | 'reserve';

export type ServiceType = 'medical' | 'housing' | 'education' | 'employment' | 'pension';

export interface Veteran {
  veteranId: string;
  category: VeteranCategory;
  age: number;
  disabilityRate: number; // 0~100
  hasSpouse: boolean;
  monthlyIncomeKRW: number;
  registeredAt: string;
}

export interface ServiceRequest {
  requestId: string;
  veteranId: string;
  serviceType: ServiceType;
  submittedAt: string;
}

export interface PrioritizedRequest {
  requestId: string;
  veteranId: string;
  serviceType: ServiceType;
  priorityScore: number;
  rank: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class VeteranServicePriorityAI {
  private veterans = new Map<string, Veteran>();
  private requests = new Map<string, ServiceRequest>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R579.1
  registerVeteran(v: Veteran, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (v.disabilityRate < 0 || v.disabilityRate > 100) {
      throw new Error('장애율은 0~100 범위여야 합니다');
    }
    this.veterans.set(v.veteranId, { ...v });
    this.append('REGISTER_VETERAN', { veteranId: v.veteranId, category: v.category });
  }

  // Plan SC: FR-R579.2
  submitRequest(req: ServiceRequest, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.veterans.has(req.veteranId)) {
      throw new Error(`보훈대상자 미등록: ${req.veteranId}`);
    }
    this.requests.set(req.requestId, { ...req });
    this.append('SUBMIT_REQUEST', { requestId: req.requestId });
  }

  // Plan SC: FR-R579.3
  computePriority(requestId: string): number {
    const req = this.requests.get(requestId);
    if (!req) throw new Error(`요청 미등록: ${requestId}`);
    const v = this.veterans.get(req.veteranId);
    if (!v) throw new Error(`보훈대상자 미등록: ${req.veteranId}`);

    let score = 0;
    switch (v.category) {
      case 'independence':
        score += 50;
        break;
      case 'disabled_combat':
        score += 45;
        break;
      case 'national_merit':
        score += 40;
        break;
      case 'korean_war':
        score += 35;
        break;
      case 'vietnam_war':
        score += 25;
        break;
      case 'reserve':
        score += 15;
        break;
    }

    score += Math.floor(v.disabilityRate / 10) * 3;
    if (v.age >= 80) score += 20;
    else if (v.age >= 70) score += 12;
    else if (v.age >= 60) score += 6;

    if (v.monthlyIncomeKRW < 1_500_000) score += 10;
    if (!v.hasSpouse && v.age >= 65) score += 8;

    if (req.serviceType === 'medical') score += 10;
    else if (req.serviceType === 'housing') score += 6;

    return score;
  }

  // Plan SC: FR-R579.4
  getPrioritizedQueue(serviceType?: ServiceType): PrioritizedRequest[] {
    const items = Array.from(this.requests.values())
      .filter(r => !serviceType || r.serviceType === serviceType)
      .map(r => {
        const score = this.computePriority(r.requestId);
        return {
          requestId: r.requestId,
          veteranId: r.veteranId,
          serviceType: r.serviceType,
          priorityScore: score,
          rank: 0,
        };
      });
    items.sort((a, b) => b.priorityScore - a.priorityScore);
    items.forEach((item, idx) => {
      item.rank = idx + 1;
    });
    this.append('BUILD_QUEUE', { count: items.length, serviceType: serviceType ?? 'all' });
    return items;
  }

  // Plan SC: FR-R579.5
  countByCategory(): Record<VeteranCategory, number> {
    const counts: Record<VeteranCategory, number> = {
      independence: 0,
      national_merit: 0,
      disabled_combat: 0,
      korean_war: 0,
      vietnam_war: 0,
      reserve: 0,
    };
    for (const v of this.veterans.values()) counts[v.category] += 1;
    return counts;
  }

  // Plan SC: FR-R579.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
