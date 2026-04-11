// 테넌트 데이터 내보내기/이관 -- FR-N347.1~FR-N347.4
// Design Ref: MTU-N347 | CSAP: D-06, D-08, D-09

export interface ExportJob { readonly jobId: string; readonly tenantId: string; readonly format: 'json' | 'csv'; readonly status: 'pending' | 'running' | 'completed' | 'failed'; readonly tables: readonly string[]; readonly includesPII: boolean; readonly maskPII: boolean; readonly createdAt: string; readonly completedAt: string | null; }
export interface ExportResult { readonly jobId: string; readonly format: string; readonly data: string; readonly recordCount: number; readonly sizeBytes: number; readonly maskedFields: readonly string[]; }
export interface ExportAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: ExportAuditEntry[] = [];
function recordAudit(entry: Omit<ExportAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getExportAuditLog(tenantId: string): readonly ExportAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const PII_FIELDS = ['주민번호', 'ssn', 'phone', 'email', 'address', '전화번호', '이메일', '주소'];

export function createExportJob(tenantId: string, format: 'json' | 'csv', tables: string[], maskPII: boolean = true): ExportJob {
  const includesPII = tables.some(t => PII_FIELDS.some(p => t.toLowerCase().includes(p)));
  const job: ExportJob = { jobId: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, format, status: 'pending', tables, includesPII, maskPII, createdAt: new Date().toISOString(), completedAt: null };
  recordAudit({ actor: 'system', tenantId, action: 'EXPORT_JOB_CREATED', target: job.jobId, details: { format, tables, maskPII } });
  return job;
}

function maskValue(value: string): string {
  if (value.length <= 4) return '*'.repeat(value.length);
  return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
}

export function serializeToJSON(records: Record<string, string>[], piiFields: string[], mask: boolean): { data: string; maskedFields: string[] } {
  const masked: string[] = [];
  const processed = records.map(r => {
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      if (mask && piiFields.some(p => k.toLowerCase().includes(p))) { row[k] = maskValue(v); if (!masked.includes(k)) masked.push(k); }
      else row[k] = v;
    }
    return row;
  });
  return { data: JSON.stringify(processed, null, 2), maskedFields: masked };
}

export function serializeToCSV(records: Record<string, string>[], piiFields: string[], mask: boolean): { data: string; maskedFields: string[] } {
  if (records.length === 0) return { data: '', maskedFields: [] };
  const firstRecord = records[0]!;
  const headers = Object.keys(firstRecord);
  const masked: string[] = [];
  const lines = [headers.join(',')];
  for (const r of records) {
    const values = headers.map(h => {
      const v = r[h] ?? '';
      if (mask && piiFields.some(p => h.toLowerCase().includes(p))) { if (!masked.includes(h)) masked.push(h); return maskValue(v); }
      return v;
    });
    lines.push(values.join(','));
  }
  return { data: lines.join('\n'), maskedFields: masked };
}

export function executeExport(tenantId: string, job: ExportJob, records: Record<string, string>[]): ExportResult {
  const pii = PII_FIELDS;
  const { data, maskedFields } = job.format === 'json' ? serializeToJSON(records, pii, job.maskPII) : serializeToCSV(records, pii, job.maskPII);
  recordAudit({ actor: 'system', tenantId, action: 'EXPORT_COMPLETED', target: job.jobId, details: { records: records.length, format: job.format, maskedFields } });
  return { jobId: job.jobId, format: job.format, data, recordCount: records.length, sizeBytes: new TextEncoder().encode(data).length, maskedFields };
}

export class TenantDataExportService {
  constructor(private readonly tenantId: string) {}
  create(format: 'json' | 'csv', tables: string[], mask?: boolean): ExportJob { return createExportJob(this.tenantId, format, tables, mask); }
  execute(job: ExportJob, records: Record<string, string>[]): ExportResult { return executeExport(this.tenantId, job, records); }
  getAuditLog(): readonly ExportAuditEntry[] { return getExportAuditLog(this.tenantId); }
}
