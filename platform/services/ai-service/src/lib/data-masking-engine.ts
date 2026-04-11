// 정적/동적 데이터 마스킹 엔진 -- FR-N337.1~FR-N337.4
// Design Ref: MTU-N337 | CSAP: D-06, D-08, D-09

export interface MaskingRule { readonly ruleId: string; readonly fieldName: string; readonly type: 'full' | 'partial' | 'hash' | 'substitute' | 'nullify'; readonly pattern?: string; readonly preserveLength: boolean; }
export interface MaskingResult { readonly fieldName: string; readonly original: string; readonly masked: string; readonly ruleApplied: string; }
export interface MaskingAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: MaskingAuditEntry[] = [];
function recordAudit(entry: Omit<MaskingAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getMaskingAuditLog(tenantId: string): readonly MaskingAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const ruleStore: Map<string, MaskingRule[]> = new Map();

export function defineRule(tenantId: string, fieldName: string, type: MaskingRule['type'], preserveLength: boolean = true, pattern?: string): MaskingRule {
  const rule: MaskingRule = { ruleId: `mask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, fieldName, type, pattern, preserveLength };
  const existing = ruleStore.get(tenantId) ?? [];
  existing.push(rule);
  ruleStore.set(tenantId, existing);
  return rule;
}

export function applyMask(value: string, rule: MaskingRule): string {
  switch (rule.type) {
    case 'full': return rule.preserveLength ? '*'.repeat(value.length) : '****';
    case 'partial': {
      if (value.length <= 4) return '*'.repeat(value.length);
      const show = Math.min(2, Math.floor(value.length / 4));
      return value.slice(0, show) + '*'.repeat(value.length - show * 2) + value.slice(-show);
    }
    case 'hash': {
      let h = 0;
      for (let i = 0; i < value.length; i++) h = ((h << 5) - h + value.charCodeAt(i)) | 0;
      return `hash_${Math.abs(h).toString(16)}`;
    }
    case 'substitute': return rule.pattern ?? '[REDACTED]';
    case 'nullify': return '';
    default: return value;
  }
}

export function maskStaticData(tenantId: string, data: Record<string, string>): MaskingResult[] {
  const rules = ruleStore.get(tenantId) ?? [];
  const results: MaskingResult[] = [];
  for (const [field, value] of Object.entries(data)) {
    const rule = rules.find(r => r.fieldName === field);
    if (rule) {
      results.push({ fieldName: field, original: value, masked: applyMask(value, rule), ruleApplied: rule.ruleId });
    } else {
      results.push({ fieldName: field, original: value, masked: value, ruleApplied: 'none' });
    }
  }
  recordAudit({ actor: 'system', tenantId, action: 'STATIC_MASKING_APPLIED', target: tenantId, details: { fields: results.length, masked: results.filter(r => r.ruleApplied !== 'none').length } });
  return results;
}

export function maskDynamic(tenantId: string, field: string, value: string): string {
  const rules = ruleStore.get(tenantId) ?? [];
  const rule = rules.find(r => r.fieldName === field);
  if (!rule) return value;
  recordAudit({ actor: 'system', tenantId, action: 'DYNAMIC_MASKING_APPLIED', target: field, details: { ruleId: rule.ruleId } });
  return applyMask(value, rule);
}

export class DataMaskingEngineService {
  constructor(private readonly tenantId: string) {}
  defineRule(field: string, type: MaskingRule['type'], preserve?: boolean, pattern?: string): MaskingRule { return defineRule(this.tenantId, field, type, preserve, pattern); }
  maskStatic(data: Record<string, string>): MaskingResult[] { return maskStaticData(this.tenantId, data); }
  maskDynamic(field: string, value: string): string { return maskDynamic(this.tenantId, field, value); }
  getAuditLog(): readonly MaskingAuditEntry[] { return getMaskingAuditLog(this.tenantId); }
}
