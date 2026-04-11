// 공공데이터 품질/통계 분석 -- FR-N356.1~FR-N356.4
// Design Ref: MTU-N356 | CSAP: D-06, D-08

export interface DataProfile { readonly fieldName: string; readonly dataType: string; readonly totalCount: number; readonly nullCount: number; readonly uniqueCount: number; readonly completeness: number; }
export interface QualityMetrics { readonly totalFields: number; readonly overallCompleteness: number; readonly overallUniqueness: number; readonly issues: readonly string[]; }
export interface StatsSummary { readonly reportId: string; readonly tenantId: string; readonly recordCount: number; readonly profiles: readonly DataProfile[]; readonly quality: QualityMetrics; readonly generatedAt: string; }
export interface DataAnalyzerAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: DataAnalyzerAuditEntry[] = [];
function recordAudit(entry: Omit<DataAnalyzerAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getDataAnalyzerAuditLog(tenantId: string): readonly DataAnalyzerAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

export function profileField(fieldName: string, values: (string | null | undefined)[]): DataProfile {
  const total = values.length;
  const nulls = values.filter(v => v === null || v === undefined || v === '').length;
  const uniques = new Set(values.filter(v => v !== null && v !== undefined)).size;
  const dataType = values.find(v => v !== null && v !== undefined) !== undefined ? typeof values.find(v => v != null) : 'unknown';
  return { fieldName, dataType, totalCount: total, nullCount: nulls, uniqueCount: uniques, completeness: total > 0 ? (total - nulls) / total : 0 };
}

export function assessQuality(profiles: DataProfile[]): QualityMetrics {
  const issues: string[] = [];
  let totalComp = 0;
  let totalUniq = 0;
  for (const p of profiles) {
    totalComp += p.completeness;
    totalUniq += p.totalCount > 0 ? p.uniqueCount / p.totalCount : 0;
    if (p.completeness < 0.8) issues.push(`${p.fieldName}: 완전성 ${(p.completeness * 100).toFixed(0)}% 미달`);
    if (p.uniqueCount === 1 && p.totalCount > 10) issues.push(`${p.fieldName}: 단일 값만 존재 (품질 의심)`);
  }
  return { totalFields: profiles.length, overallCompleteness: profiles.length > 0 ? totalComp / profiles.length : 0, overallUniqueness: profiles.length > 0 ? totalUniq / profiles.length : 0, issues };
}

export function analyzeDataset(tenantId: string, records: Record<string, string | null>[]): StatsSummary {
  if (records.length === 0) {
    recordAudit({ actor: 'system', tenantId, action: 'DATA_ANALYZED', target: tenantId, details: { records: 0 } });
    return { reportId: `da-${Date.now()}`, tenantId, recordCount: 0, profiles: [], quality: { totalFields: 0, overallCompleteness: 0, overallUniqueness: 0, issues: [] }, generatedAt: new Date().toISOString() };
  }
  const firstRecord = records[0]!;
  const fields = Object.keys(firstRecord);
  const profiles = fields.map(f => profileField(f, records.map(r => r[f])));
  const quality = assessQuality(profiles);
  recordAudit({ actor: 'system', tenantId, action: 'DATA_ANALYZED', target: tenantId, details: { records: records.length, fields: fields.length, completeness: quality.overallCompleteness } });
  return { reportId: `da-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, recordCount: records.length, profiles, quality, generatedAt: new Date().toISOString() };
}

export class PublicDataAnalyzerService {
  constructor(private readonly tenantId: string) {}
  analyze(records: Record<string, string | null>[]): StatsSummary { return analyzeDataset(this.tenantId, records); }
  getAuditLog(): readonly DataAnalyzerAuditEntry[] { return getDataAnalyzerAuditLog(this.tenantId); }
}
