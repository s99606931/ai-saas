// API 남용 탐지 -- FR-N367.1~FR-N367.4
// Design Ref: MTU-N367 | CSAP: D-06, D-08

export interface APICallRecord { readonly callId: string; readonly clientId: string; readonly endpoint: string; readonly method: string; readonly statusCode: number; readonly responseTimeMs: number; readonly timestamp: string; }
export interface AbusePattern { readonly clientId: string; readonly patternType: 'rate_burst' | 'scraping' | 'enumeration' | 'error_flooding'; readonly description: string; readonly severity: 'low' | 'medium' | 'high' | 'critical'; readonly callCount: number; }
export interface AbuseDecision { readonly clientId: string; readonly action: 'allow' | 'throttle' | 'block'; readonly reason: string; readonly duration: number; }
export interface AbuseAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: AbuseAuditEntry[] = [];
function recordAudit(entry: Omit<AbuseAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getAbuseAuditLog(tenantId: string): readonly AbuseAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

export function detectBurst(calls: APICallRecord[], windowMs: number = 60000, threshold: number = 100): AbusePattern[] {
  const byClient = new Map<string, APICallRecord[]>();
  for (const c of calls) { const g = byClient.get(c.clientId) ?? []; g.push(c); byClient.set(c.clientId, g); }
  const patterns: AbusePattern[] = [];
  for (const [clientId, records] of byClient.entries()) {
    const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (sorted.length < 2) continue;
    const firstTs = new Date(sorted[0]!.timestamp).getTime();
    const lastTs = new Date(sorted[sorted.length - 1]!.timestamp).getTime();
    if (lastTs - firstTs <= windowMs && sorted.length >= threshold) {
      patterns.push({ clientId, patternType: 'rate_burst', description: `${sorted.length}건/${windowMs}ms 초과`, severity: 'high', callCount: sorted.length });
    }
  }
  return patterns;
}

export function detectScraping(calls: APICallRecord[]): AbusePattern[] {
  const byClient = new Map<string, Set<string>>();
  for (const c of calls) {
    const s = byClient.get(c.clientId) ?? new Set();
    s.add(c.endpoint);
    byClient.set(c.clientId, s);
  }
  const patterns: AbusePattern[] = [];
  for (const [clientId, endpoints] of byClient.entries()) {
    if (endpoints.size > 50) {
      patterns.push({ clientId, patternType: 'scraping', description: `${endpoints.size}개 엔드포인트 접근`, severity: 'medium', callCount: endpoints.size });
    }
  }
  return patterns;
}

export function decideAction(tenantId: string, patterns: AbusePattern[]): AbuseDecision[] {
  const decisions: AbuseDecision[] = [];
  const clientPatterns = new Map<string, AbusePattern[]>();
  for (const p of patterns) { const g = clientPatterns.get(p.clientId) ?? []; g.push(p); clientPatterns.set(p.clientId, g); }
  for (const [clientId, pats] of clientPatterns.entries()) {
    const maxSeverity = pats.some(p => p.severity === 'critical') ? 'critical' : pats.some(p => p.severity === 'high') ? 'high' : 'medium';
    let action: AbuseDecision['action'] = 'allow';
    let duration = 0;
    if (maxSeverity === 'critical') { action = 'block'; duration = 3600; }
    else if (maxSeverity === 'high') { action = 'throttle'; duration = 600; }
    decisions.push({ clientId, action, reason: pats.map(p => p.description).join('; '), duration });
    if (action !== 'allow') recordAudit({ actor: 'system', tenantId, action: `API_ABUSE_${action.toUpperCase()}`, target: clientId, details: { patterns: pats.length, severity: maxSeverity } });
  }
  return decisions;
}

export class ApiAbuseDetectorService {
  constructor(private readonly tenantId: string) {}
  detectBurst(calls: APICallRecord[], window?: number, threshold?: number): AbusePattern[] { return detectBurst(calls, window, threshold); }
  detectScraping(calls: APICallRecord[]): AbusePattern[] { return detectScraping(calls); }
  decide(patterns: AbusePattern[]): AbuseDecision[] { return decideAction(this.tenantId, patterns); }
  getAuditLog(): readonly AbuseAuditEntry[] { return getAbuseAuditLog(this.tenantId); }
}
