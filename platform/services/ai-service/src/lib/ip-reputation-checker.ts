// IP 평판 조회/차단 -- FR-N351.1~FR-N351.4
// Design Ref: MTU-N351 | CSAP: D-06, D-08

export interface IPReputation { readonly ip: string; readonly score: number; readonly category: 'clean' | 'suspicious' | 'malicious' | 'unknown'; readonly threatTypes: readonly string[]; readonly lastSeen: string; readonly reportCount: number; }
export interface IPDecision { readonly ip: string; readonly action: 'allow' | 'challenge' | 'block'; readonly reason: string; readonly score: number; }
export interface IPRepAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: IPRepAuditEntry[] = [];
function recordAudit(entry: Omit<IPRepAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getIPRepAuditLog(tenantId: string): readonly IPRepAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const reputationStore: Map<string, IPReputation> = new Map();

export function updateReputation(ip: string, score: number, threatTypes: string[] = []): IPReputation {
  let category: IPReputation['category'] = 'unknown';
  if (score >= 80) category = 'clean';
  else if (score >= 50) category = 'suspicious';
  else if (score < 50) category = 'malicious';
  const existing = reputationStore.get(ip);
  const rep: IPReputation = { ip, score, category, threatTypes, lastSeen: new Date().toISOString(), reportCount: (existing?.reportCount ?? 0) + 1 };
  reputationStore.set(ip, rep);
  return rep;
}

export function lookupReputation(ip: string): IPReputation | null { return reputationStore.get(ip) ?? null; }

export function evaluateAccess(tenantId: string, ip: string, blockThreshold: number = 30, challengeThreshold: number = 60): IPDecision {
  const rep = reputationStore.get(ip);
  if (!rep) {
    recordAudit({ actor: 'system', tenantId, action: 'IP_ACCESS_ALLOWED', target: ip, details: { reason: 'unknown_ip' } });
    return { ip, action: 'allow', reason: 'IP 정보 없음 (신규)', score: 100 };
  }
  let decision: IPDecision;
  if (rep.score < blockThreshold) decision = { ip, action: 'block', reason: `악성 IP (점수: ${rep.score}, 위협: ${rep.threatTypes.join(',')})`, score: rep.score };
  else if (rep.score < challengeThreshold) decision = { ip, action: 'challenge', reason: `의심 IP (점수: ${rep.score})`, score: rep.score };
  else decision = { ip, action: 'allow', reason: '정상 IP', score: rep.score };
  recordAudit({ actor: 'system', tenantId, action: `IP_ACCESS_${decision.action.toUpperCase()}`, target: ip, details: { score: rep.score, action: decision.action } });
  return decision;
}

export function bulkUpdateReputations(entries: { ip: string; score: number; threats: string[] }[]): IPReputation[] {
  return entries.map(e => updateReputation(e.ip, e.score, e.threats));
}

export class IPReputationCheckerService {
  constructor(private readonly tenantId: string) {}
  update(ip: string, score: number, threats?: string[]): IPReputation { return updateReputation(ip, score, threats); }
  lookup(ip: string): IPReputation | null { return lookupReputation(ip); }
  evaluate(ip: string): IPDecision { return evaluateAccess(this.tenantId, ip); }
  bulkUpdate(entries: { ip: string; score: number; threats: string[] }[]): IPReputation[] { return bulkUpdateReputations(entries); }
  getAuditLog(): readonly IPRepAuditEntry[] { return getIPRepAuditLog(this.tenantId); }
}
