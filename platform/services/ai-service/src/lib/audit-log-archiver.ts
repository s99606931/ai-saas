// 감사 로그 아카이빙/검색 -- FR-N352.1~FR-N352.4
// Design Ref: MTU-N352 | CSAP: D-06, D-08

export interface AuditRecord { readonly recordId: string; readonly tenantId: string; readonly actor: string; readonly action: string; readonly target: string; readonly detail: string; readonly timestamp: string; readonly archived: boolean; }
export interface ArchiveBatch { readonly batchId: string; readonly tenantId: string; readonly recordCount: number; readonly fromDate: string; readonly toDate: string; readonly archivedAt: string; }
export interface SearchResult { readonly records: readonly AuditRecord[]; readonly total: number; readonly query: string; }
export interface ArchiverAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: ArchiverAuditEntry[] = [];
function recordAudit(entry: Omit<ArchiverAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getArchiverAuditLog(tenantId: string): readonly ArchiverAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const recordStore: AuditRecord[] = [];

export function ingestRecord(tenantId: string, actor: string, action: string, target: string, detail: string): AuditRecord {
  const record: AuditRecord = { recordId: `ar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, actor, action, target, detail, timestamp: new Date().toISOString(), archived: false };
  recordStore.push(record);
  return record;
}

export function archiveRecords(tenantId: string, beforeDate: string): ArchiveBatch {
  const cutoff = new Date(beforeDate);
  let count = 0;
  let minDate = '';
  let maxDate = '';
  for (let i = 0; i < recordStore.length; i++) {
    const r = recordStore[i];
    if (r && r.tenantId === tenantId && !r.archived && new Date(r.timestamp) < cutoff) {
      recordStore[i] = { ...r, archived: true };
      count++;
      if (!minDate || r.timestamp < minDate) minDate = r.timestamp;
      if (!maxDate || r.timestamp > maxDate) maxDate = r.timestamp;
    }
  }
  const batch: ArchiveBatch = { batchId: `ab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, recordCount: count, fromDate: minDate || beforeDate, toDate: maxDate || beforeDate, archivedAt: new Date().toISOString() };
  recordAudit({ actor: 'system', tenantId, action: 'AUDIT_ARCHIVED', target: batch.batchId, details: { records: count } });
  return batch;
}

export function searchRecords(tenantId: string, query: string): SearchResult {
  const lowerQuery = query.toLowerCase();
  const matched = recordStore.filter(r => r.tenantId === tenantId && (r.action.toLowerCase().includes(lowerQuery) || r.detail.toLowerCase().includes(lowerQuery) || r.actor.toLowerCase().includes(lowerQuery) || r.target.toLowerCase().includes(lowerQuery)));
  return { records: matched, total: matched.length, query };
}

export function getRecords(tenantId: string, includeArchived: boolean = false): readonly AuditRecord[] {
  return recordStore.filter(r => r.tenantId === tenantId && (includeArchived || !r.archived));
}

export class AuditLogArchiverService {
  constructor(private readonly tenantId: string) {}
  ingest(actor: string, action: string, target: string, detail: string): AuditRecord { return ingestRecord(this.tenantId, actor, action, target, detail); }
  archive(beforeDate: string): ArchiveBatch { return archiveRecords(this.tenantId, beforeDate); }
  search(query: string): SearchResult { return searchRecords(this.tenantId, query); }
  list(includeArchived?: boolean): readonly AuditRecord[] { return getRecords(this.tenantId, includeArchived); }
  getAuditLog(): readonly ArchiverAuditEntry[] { return getArchiverAuditLog(this.tenantId); }
}
