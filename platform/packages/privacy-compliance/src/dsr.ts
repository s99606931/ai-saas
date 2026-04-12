// Design Ref: MTU-N458 §dsr
// Plan SC: FR-DSR.1 ~ FR-DSR.5
//
// 정보주체 권리 요청(Data Subject Rights) 처리 워크플로우 + SLA 추적 +
// append-only 감사 추적.

export type DsrType = 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction';
export type DsrStatus =
  | 'received'
  | 'identity_verified'
  | 'in_progress'
  | 'completed'
  | 'rejected';

export interface DsrRequest {
  id: string;
  subjectId: string;
  type: DsrType;
  status: DsrStatus;
  createdAt: string;
  verifiedAt?: string;
  completedAt?: string;
  deadlineAt: string;
  rejectionReason?: string;
}

export interface DsrAuditEntry {
  id: string;
  requestId: string;
  action: string;
  at: string;
  actor: string;
  note?: string;
}

// 개보법 처리 기한: 요청 접수 후 10일 (필요 시 10일 연장 가능 → 최대 20일)
// GDPR Art.12: 1개월
const DEFAULT_SLA_DAYS = 10;

export class DsrWorkflow {
  private requests: Map<string, DsrRequest> = new Map();
  private audit: DsrAuditEntry[] = [];
  private nextReq = 1;
  private nextAudit = 1;

  constructor(private slaDays: number = DEFAULT_SLA_DAYS) {}

  // FR-DSR.1: 요청 접수
  receive(params: { subjectId: string; type: DsrType; actor: string }): DsrRequest {
    const now = new Date();
    const deadline = new Date(now.getTime() + this.slaDays * 24 * 60 * 60 * 1000);
    const req: DsrRequest = {
      id: `dsr-${this.nextReq++}`,
      subjectId: params.subjectId,
      type: params.type,
      status: 'received',
      createdAt: now.toISOString(),
      deadlineAt: deadline.toISOString(),
    };
    this.requests.set(req.id, req);
    this.append(req.id, 'received', params.actor);
    return { ...req };
  }

  verifyIdentity(requestId: string, actor: string): DsrRequest {
    const r = this.mustGet(requestId);
    if (r.status !== 'received') {
      throw new Error(`Cannot verify in status: ${r.status}`);
    }
    r.status = 'identity_verified';
    r.verifiedAt = new Date().toISOString();
    this.append(requestId, 'identity_verified', actor);
    return { ...r };
  }

  // FR-DSR.3: 처리 워크플로우 실행
  start(requestId: string, actor: string): DsrRequest {
    const r = this.mustGet(requestId);
    if (r.status !== 'identity_verified') {
      throw new Error(`Cannot start before verification: ${r.status}`);
    }
    r.status = 'in_progress';
    this.append(requestId, 'started', actor);
    return { ...r };
  }

  complete(requestId: string, actor: string, note?: string): DsrRequest {
    const r = this.mustGet(requestId);
    if (r.status !== 'in_progress') {
      throw new Error(`Cannot complete from status: ${r.status}`);
    }
    r.status = 'completed';
    r.completedAt = new Date().toISOString();
    this.append(requestId, 'completed', actor, note);
    return { ...r };
  }

  reject(requestId: string, actor: string, reason: string): DsrRequest {
    const r = this.mustGet(requestId);
    if (r.status === 'completed') {
      throw new Error('Cannot reject completed request');
    }
    r.status = 'rejected';
    r.rejectionReason = reason;
    this.append(requestId, 'rejected', actor, reason);
    return { ...r };
  }

  // FR-DSR.4: SLA 추적
  overdueRequests(now: Date = new Date()): DsrRequest[] {
    return Array.from(this.requests.values())
      .filter(
        (r) => r.status !== 'completed' && r.status !== 'rejected' && new Date(r.deadlineAt) < now,
      )
      .map((r) => ({ ...r }));
  }

  upcomingDeadlines(withinHours: number, now: Date = new Date()): DsrRequest[] {
    const threshold = new Date(now.getTime() + withinHours * 60 * 60 * 1000);
    return Array.from(this.requests.values())
      .filter(
        (r) =>
          r.status !== 'completed' &&
          r.status !== 'rejected' &&
          new Date(r.deadlineAt) > now &&
          new Date(r.deadlineAt) <= threshold,
      )
      .map((r) => ({ ...r }));
  }

  // FR-DSR.5: 감사 추적 조회 (append-only)
  auditFor(requestId: string): DsrAuditEntry[] {
    return this.audit.filter((e) => e.requestId === requestId).map((e) => ({ ...e }));
  }

  get(requestId: string): DsrRequest | undefined {
    const r = this.requests.get(requestId);
    return r ? { ...r } : undefined;
  }

  private append(requestId: string, action: string, actor: string, note?: string): void {
    const entry: DsrAuditEntry = {
      id: `dsr-audit-${this.nextAudit++}`,
      requestId,
      action,
      at: new Date().toISOString(),
      actor,
      note,
    };
    Object.freeze(entry);
    this.audit.push(entry);
  }

  private mustGet(id: string): DsrRequest {
    const r = this.requests.get(id);
    if (!r) throw new Error(`Request not found: ${id}`);
    return r;
  }
}
