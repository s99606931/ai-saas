// API 게이트웨이 속도제한 관리 -- FR-N317.1~FR-N317.4
// Design Ref: MTU-N317 | CSAP: D-06, D-08

export type RateLimitAlgorithm = 'token_bucket' | 'sliding_window' | 'fixed_window' | 'leaky_bucket';
export interface RateLimitPolicy { readonly policyId: string; readonly tenantId: string; readonly endpoint: string; readonly algorithm: RateLimitAlgorithm; readonly limit: number; readonly windowSeconds: number; readonly burstLimit: number; readonly enabled: boolean; readonly createdAt: string; }
export interface RateLimitResult { readonly allowed: boolean; readonly remaining: number; readonly resetAt: string; readonly retryAfterSeconds: number | null; }
export interface RateLimitEvent { readonly eventId: string; readonly tenantId: string; readonly endpoint: string; readonly clientId: string; readonly allowed: boolean; readonly timestamp: string; }
export interface RateLimitAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: RateLimitAuditEntry[] = [];
function recordAudit(entry: Omit<RateLimitAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getRateLimitAuditLog(tenantId: string): readonly RateLimitAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const policyStore: Map<string, RateLimitPolicy[]> = new Map();
const counterStore: Map<string, { count: number; windowStart: number }> = new Map();

export function createRateLimitPolicy(tenantId: string, endpoint: string, limit: number, windowSeconds: number = 60, algorithm: RateLimitAlgorithm = 'sliding_window', burstLimit: number = 0): RateLimitPolicy {
  const policy: RateLimitPolicy = { policyId: `rl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, endpoint, algorithm, limit, windowSeconds, burstLimit: burstLimit || limit * 2, enabled: true, createdAt: new Date().toISOString() };
  const existing = policyStore.get(tenantId) ?? [];
  existing.push(policy);
  policyStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'RATE_LIMIT_CREATED', target: policy.policyId, details: { endpoint, limit, windowSeconds } });
  return policy;
}

export function checkRateLimit(tenantId: string, endpoint: string, clientId: string): RateLimitResult {
  const policies = policyStore.get(tenantId) ?? [];
  const policy = policies.find(p => p.endpoint === endpoint && p.enabled);
  if (!policy) return { allowed: true, remaining: Infinity, resetAt: '', retryAfterSeconds: null };

  const key = `${tenantId}:${endpoint}:${clientId}`;
  const now = Date.now();
  const counter = counterStore.get(key);
  const windowMs = policy.windowSeconds * 1000;

  if (!counter || now - counter.windowStart > windowMs) {
    counterStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: policy.limit - 1, resetAt: new Date(now + windowMs).toISOString(), retryAfterSeconds: null };
  }

  if (counter.count >= policy.limit) {
    const retryAfter = Math.ceil((counter.windowStart + windowMs - now) / 1000);
    recordAudit({ actor: clientId, tenantId, action: 'RATE_LIMIT_EXCEEDED', target: endpoint, details: { clientId, count: counter.count, limit: policy.limit } });
    return { allowed: false, remaining: 0, resetAt: new Date(counter.windowStart + windowMs).toISOString(), retryAfterSeconds: retryAfter };
  }

  counter.count++;
  return { allowed: true, remaining: policy.limit - counter.count, resetAt: new Date(counter.windowStart + windowMs).toISOString(), retryAfterSeconds: null };
}

export function getRateLimitPolicies(tenantId: string): readonly RateLimitPolicy[] { return policyStore.get(tenantId) ?? []; }

export class APIRateLimiterService {
  constructor(private readonly tenantId: string) {}
  createPolicy(endpoint: string, limit: number, windowSec?: number): RateLimitPolicy { return createRateLimitPolicy(this.tenantId, endpoint, limit, windowSec); }
  check(endpoint: string, clientId: string): RateLimitResult { return checkRateLimit(this.tenantId, endpoint, clientId); }
  getPolicies(): readonly RateLimitPolicy[] { return getRateLimitPolicies(this.tenantId); }
  getAuditLog(): readonly RateLimitAuditEntry[] { return getRateLimitAuditLog(this.tenantId); }
}
