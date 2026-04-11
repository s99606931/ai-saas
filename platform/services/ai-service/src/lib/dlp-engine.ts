// DLP 데이터 유출 방지 엔진 -- FR-N319.1~FR-N319.4
// Design Ref: MTU-N319 | CSAP: D-06, D-08, D-09

export type DataSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';
export type DLPAction = 'allow' | 'block' | 'mask' | 'encrypt' | 'alert';
export interface DLPRule { readonly ruleId: string; readonly tenantId: string; readonly name: string; readonly pattern: string; readonly sensitivity: DataSensitivity; readonly action: DLPAction; readonly enabled: boolean; }
export interface DLPScanResult { readonly scanId: string; readonly tenantId: string; readonly source: string; readonly totalItems: number; readonly violations: DLPViolation[]; readonly scannedAt: string; }
export interface DLPViolation { readonly violationId: string; readonly ruleId: string; readonly ruleName: string; readonly matchedPattern: string; readonly action: DLPAction; readonly location: string; }
export interface DLPAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: DLPAuditEntry[] = [];
function recordAudit(entry: Omit<DLPAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getDLPAuditLog(tenantId: string): readonly DLPAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const ruleStore: Map<string, DLPRule[]> = new Map();

const BUILT_IN_PATTERNS: readonly { name: string; pattern: string; sensitivity: DataSensitivity }[] = [
  { name: '주민등록번호', pattern: '\\d{6}[-]?\\d{7}', sensitivity: 'restricted' },
  { name: '신용카드번호', pattern: '\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}', sensitivity: 'confidential' },
  { name: '이메일주소', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', sensitivity: 'internal' },
  { name: '전화번호', pattern: '01[0-9][-]?\\d{3,4}[-]?\\d{4}', sensitivity: 'internal' },
  { name: 'API키', pattern: '(?:api[_-]?key|token|secret)[=:]\\s*[\\w-]{16,}', sensitivity: 'restricted' },
];

export function createDLPRule(tenantId: string, name: string, pattern: string, sensitivity: DataSensitivity, action: DLPAction): DLPRule {
  const rule: DLPRule = { ruleId: `dlp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, name, pattern, sensitivity, action, enabled: true };
  const existing = ruleStore.get(tenantId) ?? [];
  existing.push(rule);
  ruleStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'DLP_RULE_CREATED', target: rule.ruleId, details: { name, sensitivity, action } });
  return rule;
}

export function initBuiltInRules(tenantId: string): DLPRule[] {
  const rules: DLPRule[] = [];
  for (const p of BUILT_IN_PATTERNS) {
    const action: DLPAction = p.sensitivity === 'restricted' ? 'block' : p.sensitivity === 'confidential' ? 'mask' : 'alert';
    rules.push(createDLPRule(tenantId, p.name, p.pattern, p.sensitivity, action));
  }
  return rules;
}

export function scanContent(tenantId: string, source: string, content: string): DLPScanResult {
  const rules = ruleStore.get(tenantId) ?? [];
  const violations: DLPViolation[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    try {
      const regex = new RegExp(rule.pattern, 'g');
      const matches = content.match(regex);
      if (matches) {
        for (const match of matches) {
          violations.push({ violationId: `viol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ruleId: rule.ruleId, ruleName: rule.name, matchedPattern: match.slice(0, 20) + '...', action: rule.action, location: source });
        }
      }
    } catch { /* 잘못된 정규식 무시 */ }
  }
  recordAudit({ actor: 'system', tenantId, action: 'DLP_SCAN_COMPLETED', target: source, details: { violations: violations.length } });
  return { scanId: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, source, totalItems: 1, violations, scannedAt: new Date().toISOString() };
}

export function getRules(tenantId: string): readonly DLPRule[] { return ruleStore.get(tenantId) ?? []; }

export class DLPEngineService {
  constructor(private readonly tenantId: string) {}
  initRules(): DLPRule[] { return initBuiltInRules(this.tenantId); }
  addRule(name: string, pattern: string, sensitivity: DataSensitivity, action: DLPAction): DLPRule { return createDLPRule(this.tenantId, name, pattern, sensitivity, action); }
  scan(source: string, content: string): DLPScanResult { return scanContent(this.tenantId, source, content); }
  getRules(): readonly DLPRule[] { return getRules(this.tenantId); }
  getAuditLog(): readonly DLPAuditEntry[] { return getDLPAuditLog(this.tenantId); }
}
