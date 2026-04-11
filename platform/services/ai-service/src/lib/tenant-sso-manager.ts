// 테넌트별 SSO/SAML 연동 관리 -- FR-N330.1~FR-N330.4
// Design Ref: MTU-N330 | CSAP: D-06, D-08

export interface SSOProvider { readonly providerId: string; readonly tenantId: string; readonly name: string; readonly protocol: 'saml' | 'oidc'; readonly entityId: string; readonly ssoUrl: string; readonly certificate: string; readonly enabled: boolean; readonly createdAt: string; }
export interface SAMLAssertion { readonly assertionId: string; readonly issuer: string; readonly subject: string; readonly email: string; readonly roles: readonly string[]; readonly issuedAt: string; readonly expiresAt: string; readonly signature: string; }
export interface SSOSession { readonly sessionId: string; readonly tenantId: string; readonly providerId: string; readonly userId: string; readonly email: string; readonly roles: readonly string[]; readonly createdAt: string; readonly expiresAt: string; }
export interface SSOAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: SSOAuditEntry[] = [];
function recordAudit(entry: Omit<SSOAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getSSOAuditLog(tenantId: string): readonly SSOAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const providerStore: Map<string, SSOProvider[]> = new Map();
const sessionStore: Map<string, SSOSession[]> = new Map();

export function createSSOProvider(tenantId: string, name: string, protocol: 'saml' | 'oidc', entityId: string, ssoUrl: string, certificate: string): SSOProvider {
  const provider: SSOProvider = { providerId: `sso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, name, protocol, entityId, ssoUrl, certificate, enabled: true, createdAt: new Date().toISOString() };
  const existing = providerStore.get(tenantId) ?? [];
  existing.push(provider);
  providerStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'SSO_PROVIDER_CREATED', target: provider.providerId, details: { name, protocol } });
  return provider;
}

export function getSSOProviders(tenantId: string): readonly SSOProvider[] { return providerStore.get(tenantId) ?? []; }

export function validateSAMLAssertion(assertion: SAMLAssertion, provider: SSOProvider): { valid: boolean; reason: string } {
  if (assertion.issuer !== provider.entityId) return { valid: false, reason: `발급자 불일치: ${assertion.issuer} !== ${provider.entityId}` };
  const now = new Date();
  if (new Date(assertion.expiresAt) < now) return { valid: false, reason: '어설션 만료됨' };
  if (!assertion.signature) return { valid: false, reason: '서명 누락' };
  if (!assertion.email) return { valid: false, reason: '이메일 누락' };
  return { valid: true, reason: '검증 통과' };
}

export function createSSOSession(tenantId: string, providerId: string, assertion: SAMLAssertion): SSOSession {
  const sessionTtlMs = 15 * 60 * 1000; // 15분
  const session: SSOSession = { sessionId: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, providerId, userId: assertion.subject, email: assertion.email, roles: assertion.roles, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + sessionTtlMs).toISOString() };
  const existing = sessionStore.get(tenantId) ?? [];
  existing.push(session);
  sessionStore.set(tenantId, existing);
  recordAudit({ actor: assertion.subject, tenantId, action: 'SSO_SESSION_CREATED', target: session.sessionId, details: { providerId, email: assertion.email } });
  return session;
}

export class TenantSSOManagerService {
  constructor(private readonly tenantId: string) {}
  createProvider(name: string, protocol: 'saml' | 'oidc', entityId: string, ssoUrl: string, cert: string): SSOProvider { return createSSOProvider(this.tenantId, name, protocol, entityId, ssoUrl, cert); }
  getProviders(): readonly SSOProvider[] { return getSSOProviders(this.tenantId); }
  validate(assertion: SAMLAssertion, provider: SSOProvider): { valid: boolean; reason: string } { return validateSAMLAssertion(assertion, provider); }
  createSession(providerId: string, assertion: SAMLAssertion): SSOSession { return createSSOSession(this.tenantId, providerId, assertion); }
  getAuditLog(): readonly SSOAuditEntry[] { return getSSOAuditLog(this.tenantId); }
}
