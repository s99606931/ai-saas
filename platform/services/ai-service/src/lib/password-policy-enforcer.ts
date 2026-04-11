// 비밀번호 정책 관리 -- FR-N350.1~FR-N350.4
// Design Ref: MTU-N350 | CSAP: D-06, D-08, D-09

export interface PasswordPolicy { readonly policyId: string; readonly tenantId: string; readonly minLength: number; readonly maxLength: number; readonly requireUppercase: boolean; readonly requireLowercase: boolean; readonly requireDigit: boolean; readonly requireSpecial: boolean; readonly maxHistoryCount: number; readonly maxAgeDays: number; }
export interface PasswordValidation { readonly valid: boolean; readonly score: number; readonly failures: readonly string[]; }
export interface PwdAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: PwdAuditEntry[] = [];
function recordAudit(entry: Omit<PwdAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getPwdAuditLog(tenantId: string): readonly PwdAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const policyStore: Map<string, PasswordPolicy> = new Map();
const historyStore: Map<string, string[]> = new Map();

export function definePolicy(tenantId: string, opts: Partial<Omit<PasswordPolicy, 'policyId' | 'tenantId'>> = {}): PasswordPolicy {
  const policy: PasswordPolicy = { policyId: `pp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, minLength: opts.minLength ?? 8, maxLength: opts.maxLength ?? 128, requireUppercase: opts.requireUppercase ?? true, requireLowercase: opts.requireLowercase ?? true, requireDigit: opts.requireDigit ?? true, requireSpecial: opts.requireSpecial ?? true, maxHistoryCount: opts.maxHistoryCount ?? 5, maxAgeDays: opts.maxAgeDays ?? 90 };
  policyStore.set(tenantId, policy);
  recordAudit({ actor: 'system', tenantId, action: 'PASSWORD_POLICY_DEFINED', target: policy.policyId, details: { minLength: policy.minLength } });
  return policy;
}

export function validatePassword(tenantId: string, password: string): PasswordValidation {
  const policy = policyStore.get(tenantId);
  if (!policy) return { valid: true, score: 50, failures: ['정책 미설정'] };
  const failures: string[] = [];
  let score = 0;
  if (password.length >= policy.minLength) score += 20; else failures.push(`최소 ${policy.minLength}자 필요`);
  if (password.length <= policy.maxLength) score += 5; else failures.push(`최대 ${policy.maxLength}자 초과`);
  if (!policy.requireUppercase || /[A-Z]/.test(password)) score += 20; else failures.push('대문자 포함 필요');
  if (!policy.requireLowercase || /[a-z]/.test(password)) score += 15; else failures.push('소문자 포함 필요');
  if (!policy.requireDigit || /\d/.test(password)) score += 20; else failures.push('숫자 포함 필요');
  if (!policy.requireSpecial || /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score += 20; else failures.push('특수문자 포함 필요');
  return { valid: failures.length === 0, score, failures };
}

export function checkHistory(tenantId: string, userId: string, passwordHash: string): boolean {
  const key = `${tenantId}:${userId}`;
  const history = historyStore.get(key) ?? [];
  const policy = policyStore.get(tenantId);
  const maxHistory = policy?.maxHistoryCount ?? 5;
  return !history.slice(-maxHistory).includes(passwordHash);
}

export function addToHistory(tenantId: string, userId: string, passwordHash: string): void {
  const key = `${tenantId}:${userId}`;
  const history = historyStore.get(key) ?? [];
  history.push(passwordHash);
  historyStore.set(key, history);
  recordAudit({ actor: userId, tenantId, action: 'PASSWORD_CHANGED', target: userId, details: {} });
}

export class PasswordPolicyEnforcerService {
  constructor(private readonly tenantId: string) {}
  define(opts?: Parameters<typeof definePolicy>[1]): PasswordPolicy { return definePolicy(this.tenantId, opts); }
  validate(password: string): PasswordValidation { return validatePassword(this.tenantId, password); }
  checkHistory(userId: string, hash: string): boolean { return checkHistory(this.tenantId, userId, hash); }
  recordChange(userId: string, hash: string): void { addToHistory(this.tenantId, userId, hash); }
  getAuditLog(): readonly PwdAuditEntry[] { return getPwdAuditLog(this.tenantId); }
}
