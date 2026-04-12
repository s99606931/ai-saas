/**
 * 정보주체 권리 요청(DSR) 자동 처리
 * Design Ref: MTU-N458 §3
 * Plan SC: FR-DSR.1~5
 */

import { z } from 'zod';

export const DsrRequestSchema = z.object({
  requestId: z.string().min(1),
  subjectId: z.string().min(1),
  type: z.enum(['access', 'rectify', 'erase', 'port', 'restrict']),
  receivedAt: z.string(),
  verifiedAt: z.string().nullable(),
  status: z.enum(['received', 'verifying', 'processing', 'completed', 'rejected']),
  dueDate: z.string(),
});

export type DsrRequest = z.infer<typeof DsrRequestSchema>;

export interface DsrAuditEntry {
  entryId: string;
  requestId: string;
  action: string;
  actor: string;
  timestamp: string;
  detail?: string;
}

const LEGAL_SLA_DAYS = 10;

/**
 * DSR 프로세서 (FR-DSR.1~5)
 */
export class DsrProcessor {
  private requests = new Map<string, DsrRequest>();
  private audit: DsrAuditEntry[] = [];
  private seq = 0;

  private nextEntryId(): string {
    this.seq++;
    return `dsr-audit-${Date.now()}-${this.seq}`;
  }

  private appendAudit(entry: Omit<DsrAuditEntry, 'entryId' | 'timestamp'>): void {
    this.audit.push({
      ...entry,
      entryId: this.nextEntryId(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 요청 접수 (FR-DSR.1)
   */
  receive(input: {
    requestId: string;
    subjectId: string;
    type: DsrRequest['type'];
    actor: string;
  }): DsrRequest {
    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + LEGAL_SLA_DAYS);

    const request: DsrRequest = {
      requestId: input.requestId,
      subjectId: input.subjectId,
      type: input.type,
      receivedAt: now.toISOString(),
      verifiedAt: null,
      status: 'received',
      dueDate: due.toISOString(),
    };

    const validated = DsrRequestSchema.parse(request);
    this.requests.set(validated.requestId, validated);
    this.appendAudit({
      requestId: validated.requestId,
      action: 'RECEIVED',
      actor: input.actor,
      detail: `type=${input.type}`,
    });
    return validated;
  }

  /**
   * 신원 확인 완료 (FR-DSR.1)
   */
  verify(requestId: string, actor: string): DsrRequest {
    const req = this.requests.get(requestId);
    if (!req) throw new Error(`요청 없음: ${requestId}`);
    req.verifiedAt = new Date().toISOString();
    req.status = 'processing';
    this.appendAudit({ requestId, action: 'VERIFIED', actor });
    return req;
  }

  /**
   * 처리 완료 (FR-DSR.3)
   */
  complete(requestId: string, actor: string, detail?: string): DsrRequest {
    const req = this.requests.get(requestId);
    if (!req) throw new Error(`요청 없음: ${requestId}`);
    req.status = 'completed';
    this.appendAudit({ requestId, action: 'COMPLETED', actor, detail });
    return req;
  }

  /**
   * SLA 위반 체크 (FR-DSR.4)
   */
  findOverdue(now: Date = new Date()): DsrRequest[] {
    return Array.from(this.requests.values()).filter(
      (r) => r.status !== 'completed' && new Date(r.dueDate) < now,
    );
  }

  /**
   * 감사 이력 조회 (FR-DSR.5)
   */
  getAudit(requestId?: string): DsrAuditEntry[] {
    if (requestId) {
      return this.audit.filter((a) => a.requestId === requestId).map((a) => ({ ...a }));
    }
    return this.audit.map((a) => ({ ...a }));
  }

  get(requestId: string): DsrRequest | undefined {
    const r = this.requests.get(requestId);
    return r ? { ...r } : undefined;
  }
}
