// 공공데이터 품질 검증 -- FR-N311.1~FR-N311.6
// Design Ref: MTU-N311 DESIGN §1~§6
// CSAP: D-06 감사 로그, D-12 개발보안

export interface DataSchema { readonly fields: Array<{ name: string; type: 'string' | 'number' | 'date' | 'boolean'; required: boolean }>; }
export interface DataRecord { readonly [key: string]: unknown; }
export interface SchemaViolation { readonly field: string; readonly expectedType: string; readonly actualType: string; readonly recordIndex: number; }
export interface QualityScore { readonly completeness: number; readonly accuracy: number; readonly consistency: number; readonly overall: number; }
export interface QualityReport { readonly reportId: string; readonly tenantId: string; readonly recordCount: number; readonly schemaViolations: SchemaViolation[]; readonly missingValues: number; readonly outliers: number; readonly score: QualityScore; readonly generatedAt: string; }
export interface QualityAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: QualityAuditEntry[] = [];
function recordAudit(entry: Omit<QualityAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getQualityAuditLog(tenantId: string): readonly QualityAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

export function validateSchema(records: DataRecord[], schema: DataSchema): SchemaViolation[] {
  const violations: SchemaViolation[] = [];
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (!rec) continue;
    for (const field of schema.fields) {
      const val = rec[field.name];
      if (val === undefined || val === null) { if (field.required) violations.push({ field: field.name, expectedType: field.type, actualType: 'missing', recordIndex: i }); continue; }
      const actualType = typeof val;
      if (field.type === 'number' && actualType !== 'number') violations.push({ field: field.name, expectedType: 'number', actualType, recordIndex: i });
      if (field.type === 'string' && actualType !== 'string') violations.push({ field: field.name, expectedType: 'string', actualType, recordIndex: i });
      if (field.type === 'boolean' && actualType !== 'boolean') violations.push({ field: field.name, expectedType: 'boolean', actualType, recordIndex: i });
    }
  }
  return violations;
}

export function detectOutliers(records: DataRecord[], numericField: string): number[] {
  const values: number[] = [];
  for (const rec of records) { const v = rec[numericField]; if (typeof v === 'number') values.push(v); }
  if (values.length < 4) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
  const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
  const iqr = q3 - q1;
  return values.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr);
}

export function calculateQualityScore(records: DataRecord[], schema: DataSchema): QualityScore {
  let totalCells = 0; let filledCells = 0;
  for (const rec of records) { for (const field of schema.fields) { totalCells++; const v = rec[field.name]; if (v !== undefined && v !== null && v !== '') filledCells++; } }
  const completeness = totalCells > 0 ? filledCells / totalCells : 0;
  const violations = validateSchema(records, schema);
  const accuracy = totalCells > 0 ? 1 - (violations.length / totalCells) : 0;
  const consistency = accuracy > 0.9 ? 1 : accuracy;
  const overall = (completeness * 0.4 + accuracy * 0.4 + consistency * 0.2);
  return { completeness, accuracy, consistency, overall };
}

export function generateQualityReport(tenantId: string, records: DataRecord[], schema: DataSchema): QualityReport {
  const violations = validateSchema(records, schema);
  const score = calculateQualityScore(records, schema);
  let missingValues = 0;
  for (const rec of records) { for (const field of schema.fields) { if (rec[field.name] === undefined || rec[field.name] === null) missingValues++; } }
  const numericFields = schema.fields.filter(f => f.type === 'number');
  let outlierCount = 0;
  for (const f of numericFields) { outlierCount += detectOutliers(records, f.name).length; }
  recordAudit({ actor: 'system', tenantId, action: 'QUALITY_REPORT_GENERATED', target: tenantId, details: { records: records.length, score: score.overall } });
  return { reportId: `qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, recordCount: records.length, schemaViolations: violations, missingValues, outliers: outlierCount, score, generatedAt: new Date().toISOString() };
}

export class DataQualityValidatorService {
  constructor(private readonly tenantId: string) {}
  validate(records: DataRecord[], schema: DataSchema): SchemaViolation[] { return validateSchema(records, schema); }
  score(records: DataRecord[], schema: DataSchema): QualityScore { return calculateQualityScore(records, schema); }
  report(records: DataRecord[], schema: DataSchema): QualityReport { return generateQualityReport(this.tenantId, records, schema); }
  getAuditLog(): readonly QualityAuditEntry[] { return getQualityAuditLog(this.tenantId); }
}
