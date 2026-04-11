// WAF 규칙 자동 생성 -- FR-N320.1~FR-N320.4
// Design Ref: MTU-N320 | CSAP: D-06, D-08, D-12

export type AttackType = 'sqli' | 'xss' | 'rce' | 'lfi' | 'ssrf' | 'csrf' | 'path_traversal';
export interface WAFRule { readonly ruleId: string; readonly tenantId: string; readonly name: string; readonly attackType: AttackType; readonly pattern: string; readonly action: 'block' | 'log' | 'challenge'; readonly severity: 'critical' | 'high' | 'medium' | 'low'; readonly enabled: boolean; readonly createdAt: string; }
export interface WAFEvent { readonly eventId: string; readonly tenantId: string; readonly ruleId: string; readonly sourceIp: string; readonly requestPath: string; readonly attackType: AttackType; readonly blocked: boolean; readonly timestamp: string; }
export interface WAFAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: WAFAuditEntry[] = [];
function recordAudit(entry: Omit<WAFAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getWAFAuditLog(tenantId: string): readonly WAFAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const ruleStore: Map<string, WAFRule[]> = new Map();
const eventStore: WAFEvent[] = [];

const ATTACK_SIGNATURES: readonly { type: AttackType; name: string; pattern: string; severity: WAFRule['severity'] }[] = [
  { type: 'sqli', name: 'SQL Injection', pattern: "(?:union\\s+select|;\\s*drop|'\\s*or\\s*'|--\\s*$)", severity: 'critical' },
  { type: 'xss', name: 'XSS', pattern: '(?:<script|javascript:|on\\w+\\s*=)', severity: 'high' },
  { type: 'rce', name: 'Remote Code Execution', pattern: '(?:;\\s*(?:cat|ls|wget|curl)|\\$\\(|`)', severity: 'critical' },
  { type: 'lfi', name: 'Local File Inclusion', pattern: '(?:\\.\\./|/etc/passwd|/proc/self)', severity: 'high' },
  { type: 'ssrf', name: 'SSRF', pattern: '(?:127\\.0\\.0\\.1|localhost|169\\.254)', severity: 'high' },
  { type: 'path_traversal', name: 'Path Traversal', pattern: '(?:%2e%2e|\\.\\.[\\\\/])', severity: 'medium' },
];

export function generateDefaultRules(tenantId: string): WAFRule[] {
  const rules: WAFRule[] = [];
  for (const sig of ATTACK_SIGNATURES) {
    const rule: WAFRule = { ruleId: `waf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, name: sig.name, attackType: sig.type, pattern: sig.pattern, action: sig.severity === 'critical' ? 'block' : 'challenge', severity: sig.severity, enabled: true, createdAt: new Date().toISOString() };
    rules.push(rule);
  }
  const existing = ruleStore.get(tenantId) ?? [];
  existing.push(...rules);
  ruleStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'WAF_RULES_GENERATED', target: tenantId, details: { rulesGenerated: rules.length } });
  return rules;
}

export function evaluateRequest(tenantId: string, requestPath: string, _requestBody: string, sourceIp: string): WAFEvent[] {
  const rules = ruleStore.get(tenantId) ?? [];
  const events: WAFEvent[] = [];
  const fullContent = `${requestPath} ${_requestBody}`;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(fullContent)) {
        const event: WAFEvent = { eventId: `waf-evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, ruleId: rule.ruleId, sourceIp, requestPath, attackType: rule.attackType, blocked: rule.action === 'block', timestamp: new Date().toISOString() };
        events.push(event);
        eventStore.push(event);
        recordAudit({ actor: sourceIp, tenantId, action: 'WAF_ATTACK_DETECTED', target: rule.ruleId, details: { attackType: rule.attackType, blocked: event.blocked, path: requestPath } });
      }
    } catch { /* 잘못된 정규식 무시 */ }
  }
  return events;
}

export function getWAFRules(tenantId: string): readonly WAFRule[] { return ruleStore.get(tenantId) ?? []; }
export function getWAFEvents(tenantId: string): readonly WAFEvent[] { return eventStore.filter(e => e.tenantId === tenantId); }

export class WAFRuleGeneratorService {
  constructor(private readonly tenantId: string) {}
  generateDefaults(): WAFRule[] { return generateDefaultRules(this.tenantId); }
  evaluate(path: string, body: string, ip: string): WAFEvent[] { return evaluateRequest(this.tenantId, path, body, ip); }
  getRules(): readonly WAFRule[] { return getWAFRules(this.tenantId); }
  getEvents(): readonly WAFEvent[] { return getWAFEvents(this.tenantId); }
  getAuditLog(): readonly WAFAuditEntry[] { return getWAFAuditLog(this.tenantId); }
}
