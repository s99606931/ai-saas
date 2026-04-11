// CIS 벤치마크 보안 기준선 점검 -- FR-N335.1~FR-N335.4
// Design Ref: MTU-N335 | CSAP: D-06, D-08, D-12

export interface SecurityRule { readonly ruleId: string; readonly category: string; readonly title: string; readonly description: string; readonly severity: 'critical' | 'high' | 'medium' | 'low'; readonly checkFn: string; }
export interface CheckResult { readonly ruleId: string; readonly title: string; readonly severity: string; readonly passed: boolean; readonly detail: string; }
export interface BaselineReport { readonly reportId: string; readonly tenantId: string; readonly totalRules: number; readonly passed: number; readonly failed: number; readonly complianceRate: number; readonly results: readonly CheckResult[]; readonly generatedAt: string; }
export interface BaselineAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: BaselineAuditEntry[] = [];
function recordAudit(entry: Omit<BaselineAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getBaselineAuditLog(tenantId: string): readonly BaselineAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const ruleStore: SecurityRule[] = [];

export function registerRule(ruleId: string, category: string, title: string, description: string, severity: SecurityRule['severity'], checkFn: string): SecurityRule {
  const rule: SecurityRule = { ruleId, category, title, description, severity, checkFn };
  ruleStore.push(rule);
  return rule;
}

export function getRules(): readonly SecurityRule[] { return ruleStore; }

export function checkSetting(rule: SecurityRule, systemConfig: Record<string, unknown>): CheckResult {
  const configValue = systemConfig[rule.checkFn];
  const passed = configValue === true || configValue === 'enabled' || configValue === 'on';
  return { ruleId: rule.ruleId, title: rule.title, severity: rule.severity, passed, detail: passed ? `${rule.title}: 준수` : `${rule.title}: 미준수 (현재: ${String(configValue ?? '미설정')})` };
}

export function runBaseline(tenantId: string, systemConfig: Record<string, unknown>): BaselineReport {
  const results: CheckResult[] = ruleStore.map(r => checkSetting(r, systemConfig));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const rate = results.length > 0 ? passed / results.length : 0;
  recordAudit({ actor: 'system', tenantId, action: 'BASELINE_CHECK_COMPLETED', target: tenantId, details: { rules: results.length, passed, failed, complianceRate: rate } });
  return { reportId: `bl-rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, totalRules: results.length, passed, failed, complianceRate: rate, results, generatedAt: new Date().toISOString() };
}

export class SecurityBaselineCheckerService {
  constructor(private readonly tenantId: string) {}
  register(id: string, cat: string, title: string, desc: string, sev: SecurityRule['severity'], check: string): SecurityRule { return registerRule(id, cat, title, desc, sev, check); }
  check(config: Record<string, unknown>): BaselineReport { return runBaseline(this.tenantId, config); }
  getAuditLog(): readonly BaselineAuditEntry[] { return getBaselineAuditLog(this.tenantId); }
}
