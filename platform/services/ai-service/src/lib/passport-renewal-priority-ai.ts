// Design Ref: §여권 갱신 — 만료·출국 임박도 기반 우선순위 AI
// Plan SC: FR-R549.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface RenewalRequest {
  requestId: string;
  daysUntilExpiry: number;
  daysUntilDeparture: number | null;
  purposeCategory: 'leisure' | 'business' | 'medical' | 'study' | 'emergency';
  firstTimeApplicant: boolean;
}

export interface PriorityResult {
  requestId: string;
  priorityScore: number; // 0~100 (높을수록 우선)
  tier: 'expedited' | 'standard' | 'low';
  etaBusinessDays: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class PassportRenewalPriorityAI {
  private requests = new Map<string, RenewalRequest>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R549.1
  submit(req: RenewalRequest, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (req.daysUntilExpiry < -3650) throw new Error('만료일이 유효하지 않습니다');
    if (req.daysUntilDeparture !== null && req.daysUntilDeparture < 0) {
      throw new Error('출국 예정일은 0 이상이어야 합니다');
    }
    this.requests.set(req.requestId, { ...req });
    this.append('SUBMIT', { requestId: req.requestId });
  }

  // Plan SC: FR-R549.2
  score(requestId: string, grade: DataGrade = 'O'): PriorityResult {
    blockClassifiedData(grade);
    const r = this.requests.get(requestId);
    if (!r) throw new Error(`요청 미등록: ${requestId}`);
    let s = 0;

    if (r.daysUntilExpiry < 0) s += 40;
    else if (r.daysUntilExpiry < 30) s += 30;
    else if (r.daysUntilExpiry < 90) s += 15;

    if (r.daysUntilDeparture !== null) {
      if (r.daysUntilDeparture < 7) s += 40;
      else if (r.daysUntilDeparture < 30) s += 20;
      else if (r.daysUntilDeparture < 60) s += 10;
    }

    if (r.purposeCategory === 'emergency') s += 20;
    else if (r.purposeCategory === 'medical') s += 15;
    else if (r.purposeCategory === 'business' || r.purposeCategory === 'study') s += 5;

    if (r.firstTimeApplicant) s += 5;

    s = Math.min(100, s);
    const tier: 'expedited' | 'standard' | 'low' = s >= 60 ? 'expedited' : s >= 25 ? 'standard' : 'low';
    const etaBusinessDays = tier === 'expedited' ? 2 : tier === 'standard' ? 7 : 14;

    const result: PriorityResult = { requestId, priorityScore: s, tier, etaBusinessDays };
    this.append('SCORE', { requestId, tier });
    return result;
  }

  // Plan SC: FR-R549.3
  listByTier(tier: 'expedited' | 'standard' | 'low'): string[] {
    const ids: string[] = [];
    for (const [id] of this.requests) {
      if (this.score(id).tier === tier) ids.push(id);
    }
    return ids;
  }

  // Plan SC: FR-R549.4
  count(): number {
    return this.requests.size;
  }

  // Plan SC: FR-R549.5
  get(requestId: string): RenewalRequest | undefined {
    const r = this.requests.get(requestId);
    return r ? { ...r } : undefined;
  }

  // Plan SC: FR-R549.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
