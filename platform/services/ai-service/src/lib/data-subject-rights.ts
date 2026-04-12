// Design Ref: MTU-N458 §정보주체 권리 요청 자동 처리
// Plan SC: FR-DSR.1~5

export type DsrType = 'access' | 'correct' | 'delete' | 'port' | 'stop';
export type DsrStatus = 'received' | 'verifying' | 'processing' | 'completed' | 'rejected' | 'overdue';

export interface DsrRequest {
  id: string;
  subjectId: string;
  type: DsrType;
  receivedAt: string; // ISO
  deadlineAt: string;
  status: DsrStatus;
  identityVerified: boolean;
  history: Array<{ action: string; at: string; actor: string }>;
}

export interface SlaStatus {
  requestId: string;
  daysRemaining: number;
  overdue: boolean;
}

export class DataSubjectRights {
  private requests = new Map<string, DsrRequest>();
  private auditLog: Array<{ requestId: string; action: string; timestamp: string; actor: string }> = [];

  /** FR-DSR.1 요청 접수 */
  receive(id: string, subjectId: string, type: DsrType, receivedAt: Date): DsrRequest {
    const deadline = new Date(receivedAt);
    deadline.setDate(deadline.getDate() + 10); // 법정 10일
    const req: DsrRequest = {
      id,
      subjectId,
      type,
      receivedAt: receivedAt.toISOString(),
      deadlineAt: deadline.toISOString(),
      status: 'received',
      identityVerified: false,
      history: [],
    };
    this.requests.set(id, req);
    this.append(id, 'received', 'system');
    return req;
  }

  /** FR-DSR.1 신원 확인 */
  verifyIdentity(requestId: string, actor: string): DsrRequest {
    const r = this.requests.get(requestId);
    if (!r) throw new Error('요청 없음');
    r.identityVerified = true;
    r.status = 'verifying';
    this.append(requestId, 'verify-identity', actor);
    return r;
  }

  /** FR-DSR.2/3 워크플로우 실행 */
  startProcessing(requestId: string, actor: string): DsrRequest {
    const r = this.requests.get(requestId);
    if (!r) throw new Error('요청 없음');
    if (!r.identityVerified) throw new Error('신원 확인 필요');
    r.status = 'processing';
    this.append(requestId, `start-${r.type}`, actor);
    return r;
  }

  complete(requestId: string, actor: string): DsrRequest {
    const r = this.requests.get(requestId);
    if (!r) throw new Error('요청 없음');
    r.status = 'completed';
    this.append(requestId, 'completed', actor);
    return r;
  }

  /** FR-DSR.4 SLA 추적 */
  checkSla(requestId: string, now: Date): SlaStatus {
    const r = this.requests.get(requestId);
    if (!r) throw new Error('요청 없음');
    const deadline = new Date(r.deadlineAt).getTime();
    const nowMs = now.getTime();
    const daysRemaining = Math.floor((deadline - nowMs) / 86400000);
    const overdue = daysRemaining < 0;
    if (overdue && r.status !== 'completed') r.status = 'overdue';
    return { requestId, daysRemaining, overdue };
  }

  /** FR-DSR.5 감사 로그 (append-only) */
  getAuditLog(requestId?: string): Array<{ requestId: string; action: string; timestamp: string; actor: string }> {
    return requestId ? this.auditLog.filter((a) => a.requestId === requestId) : [...this.auditLog];
  }

  private append(requestId: string, action: string, actor: string): void {
    const entry = { requestId, action, timestamp: new Date().toISOString(), actor };
    this.auditLog.push(entry);
    const r = this.requests.get(requestId);
    if (r) r.history.push({ action, at: entry.timestamp, actor });
  }
}

export const dataSubjectRights = new DataSubjectRights();
