// Design Ref: MTU-N455 §마이데이터 동의 관리
// Plan SC: FR-MD.1~5

export type ConsentStatus = 'active' | 'withdrawn' | 'expired';
export type ConsentType = 'required' | 'optional';

export interface ConsentScope {
  itemCode: string;
  itemName: string;
  purpose: string;
  enabled: boolean;
}

export interface ConsentRecord {
  id: string;
  subjectId: string;
  type: ConsentType;
  scopes: ConsentScope[];
  status: ConsentStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  withdrawnAt?: string;
}

export interface AuditEntry {
  recordId: string;
  action: 'create' | 'update' | 'withdraw' | 'expire';
  timestamp: string;
  actor: string;
  detail: string;
}

export interface DsrRoute {
  requestType: 'access' | 'correct' | 'delete' | 'port' | 'stop';
  targetRecordId: string;
  handler: string;
}

export class MydataConsentPlatform {
  private records = new Map<string, ConsentRecord>();
  private auditLog: AuditEntry[] = [];

  /** FR-MD.1 동의 수집 */
  createConsent(record: Omit<ConsentRecord, 'status' | 'createdAt' | 'updatedAt'>, actor: string): ConsentRecord {
    const now = new Date().toISOString();
    const full: ConsentRecord = { ...record, status: 'active', createdAt: now, updatedAt: now };
    this.records.set(full.id, full);
    this.appendAudit({ recordId: full.id, action: 'create', timestamp: now, actor, detail: `${record.type} 동의 생성` });
    return full;
  }

  /** FR-MD.2 동의 철회 */
  withdraw(recordId: string, actor: string): ConsentRecord {
    const r = this.records.get(recordId);
    if (!r) throw new Error('동의 없음');
    if (r.type === 'required') throw new Error('필수 동의는 철회 불가');
    const now = new Date().toISOString();
    r.status = 'withdrawn';
    r.withdrawnAt = now;
    r.updatedAt = now;
    this.appendAudit({ recordId, action: 'withdraw', timestamp: now, actor, detail: '동의 철회' });
    return r;
  }

  /** FR-MD.3 동적 범위 제어 */
  toggleScope(recordId: string, itemCode: string, enabled: boolean, actor: string): ConsentRecord {
    const r = this.records.get(recordId);
    if (!r) throw new Error('동의 없음');
    const scope = r.scopes.find((s) => s.itemCode === itemCode);
    if (!scope) throw new Error('범위 없음');
    scope.enabled = enabled;
    const now = new Date().toISOString();
    r.updatedAt = now;
    this.appendAudit({ recordId, action: 'update', timestamp: now, actor, detail: `${itemCode}: ${enabled}` });
    return r;
  }

  /** FR-MD.4 감사 로그 (append-only) */
  getAuditLog(recordId?: string): AuditEntry[] {
    return recordId ? this.auditLog.filter((e) => e.recordId === recordId) : [...this.auditLog];
  }

  /** FR-MD.5 권리 요청 라우팅 */
  routeDsr(requestType: DsrRoute['requestType'], recordId: string): DsrRoute {
    const handlers: Record<DsrRoute['requestType'], string> = {
      access: 'data-access-service',
      correct: 'data-correction-service',
      delete: 'data-deletion-service',
      port: 'data-portability-service',
      stop: 'processing-stop-service',
    };
    return { requestType, targetRecordId: recordId, handler: handlers[requestType] };
  }

  private appendAudit(entry: AuditEntry): void {
    this.auditLog.push(entry); // append-only
  }
}

export const mydataConsentPlatform = new MydataConsentPlatform();
