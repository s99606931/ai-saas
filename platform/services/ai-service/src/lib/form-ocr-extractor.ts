// 공공 서식 OCR 데이터 추출 -- FR-N329.1~FR-N329.4
// Design Ref: MTU-N329 | CSAP: D-06, D-08

export interface FormField { readonly fieldId: string; readonly name: string; readonly type: 'text' | 'number' | 'date' | 'checkbox' | 'signature'; readonly required: boolean; readonly pattern?: string; }
export interface FormTemplate { readonly templateId: string; readonly name: string; readonly category: string; readonly fields: readonly FormField[]; }
export interface OcrExtraction { readonly fieldId: string; readonly fieldName: string; readonly rawValue: string; readonly normalizedValue: string; readonly confidence: number; readonly valid: boolean; }
export interface ExtractionResult { readonly extractionId: string; readonly templateId: string; readonly tenantId: string; readonly extractions: readonly OcrExtraction[]; readonly overallConfidence: number; readonly validFieldRate: number; readonly extractedAt: string; }
export interface OcrAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: OcrAuditEntry[] = [];
function recordAudit(entry: Omit<OcrAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getOcrAuditLog(tenantId: string): readonly OcrAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const templateStore: Map<string, FormTemplate> = new Map();

export function registerTemplate(templateId: string, name: string, category: string, fields: FormField[]): FormTemplate {
  const template: FormTemplate = { templateId, name, category, fields };
  templateStore.set(templateId, template);
  return template;
}

export function normalizeValue(raw: string, type: FormField['type']): string {
  const trimmed = raw.trim();
  if (type === 'number') return trimmed.replace(/[^\d.-]/g, '');
  if (type === 'date') return trimmed.replace(/[/\\.]/g, '-');
  if (type === 'checkbox') return trimmed === '1' || trimmed.toLowerCase() === 'true' || trimmed === 'v' ? 'true' : 'false';
  return trimmed;
}

export function validateField(value: string, field: FormField): boolean {
  if (field.required && !value) return false;
  if (field.pattern) { try { return new RegExp(field.pattern).test(value); } catch { return false; } }
  if (field.type === 'number' && value) return !isNaN(Number(value));
  if (field.type === 'date' && value) return /^\d{4}-\d{2}-\d{2}$/.test(value);
  return true;
}

export function extractFormData(tenantId: string, templateId: string, ocrData: Record<string, { value: string; confidence: number }>): ExtractionResult {
  const template = templateStore.get(templateId);
  if (!template) throw new Error(`템플릿 미등록: ${templateId}`);
  const extractions: OcrExtraction[] = [];
  for (const field of template.fields) {
    const data = ocrData[field.fieldId];
    const raw = data?.value ?? '';
    const normalized = normalizeValue(raw, field.type);
    const confidence = data?.confidence ?? 0;
    const valid = validateField(normalized, field);
    extractions.push({ fieldId: field.fieldId, fieldName: field.name, rawValue: raw, normalizedValue: normalized, confidence, valid });
  }
  const overallConf = extractions.length > 0 ? extractions.reduce((s, e) => s + e.confidence, 0) / extractions.length : 0;
  const validRate = extractions.length > 0 ? extractions.filter(e => e.valid).length / extractions.length : 0;
  recordAudit({ actor: 'system', tenantId, action: 'OCR_EXTRACTION_COMPLETED', target: templateId, details: { fields: extractions.length, validRate, overallConfidence: overallConf } });
  return { extractionId: `ocr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, templateId, tenantId, extractions, overallConfidence: overallConf, validFieldRate: validRate, extractedAt: new Date().toISOString() };
}

export class FormOcrExtractorService {
  constructor(private readonly tenantId: string) {}
  register(id: string, name: string, cat: string, fields: FormField[]): FormTemplate { return registerTemplate(id, name, cat, fields); }
  extract(templateId: string, ocrData: Record<string, { value: string; confidence: number }>): ExtractionResult { return extractFormData(this.tenantId, templateId, ocrData); }
  getAuditLog(): readonly OcrAuditEntry[] { return getOcrAuditLog(this.tenantId); }
}
