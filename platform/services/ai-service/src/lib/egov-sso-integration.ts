// 행안부 전자정부 통합 SSO 연동 -- FR-N388.1~FR-N388.5
// Design Ref: MTU-N388 | CSAP: D-08, D-09

export interface SamlAuthnRequest {
  readonly requestId: string;
  readonly issuer: string;
  readonly destination: string;
  readonly issueInstant: string;
  readonly acsUrl: string;
}

export interface SamlAssertion {
  readonly assertionId: string;
  readonly issuer: string;
  readonly subject: string;
  readonly audience: string;
  readonly issueInstant: string;
  readonly notOnOrAfter: string;
  readonly attributes: Record<string, string>;
  readonly signature: string;
}

export interface SsoSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly attributes: Record<string, string>;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface SsoAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const sessions: SsoSession[] = [];
const auditLog: SsoAuditEntry[] = [];

function recordAudit(entry: Omit<SsoAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getSsoAuditLog(tenantId: string): readonly SsoAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function createAuthnRequest(issuer: string, destination: string, acsUrl: string): SamlAuthnRequest {
  return {
    requestId: `_${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    issuer,
    destination,
    issueInstant: new Date().toISOString(),
    acsUrl,
  };
}

export function computeSignatureStub(assertionId: string, issuer: string, subject: string): string {
  // 실제로는 XMLDSig 서명. 여기서는 결정적 해시 스텁.
  const data = `${assertionId}:${issuer}:${subject}`;
  let h = 0;
  for (let i = 0; i < data.length; i++) h = ((h << 5) - h + data.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0');
}

export function verifySignature(assertion: SamlAssertion): boolean {
  const expected = computeSignatureStub(assertion.assertionId, assertion.issuer, assertion.subject);
  return assertion.signature === expected;
}

export function validateAssertion(
  assertion: SamlAssertion,
  expectedAudience: string,
  now = Date.now(),
): { valid: boolean; errors: readonly string[] } {
  const errors: string[] = [];
  if (!verifySignature(assertion)) errors.push('서명 위조');
  if (assertion.audience !== expectedAudience) errors.push('audience 불일치');
  const notOnOrAfter = new Date(assertion.notOnOrAfter).getTime();
  if (notOnOrAfter < now) errors.push('assertion 만료');
  if (!assertion.subject) errors.push('subject 누락');
  return { valid: errors.length === 0, errors };
}

export function createSession(
  tenantId: string,
  assertion: SamlAssertion,
  durationMs = 900_000,
): SsoSession {
  const now = Date.now();
  const session: SsoSession = {
    sessionId: `sess-${now}-${Math.random().toString(36).slice(2, 10)}`,
    userId: assertion.subject,
    tenantId,
    attributes: { ...assertion.attributes },
    createdAt: now,
    expiresAt: now + durationMs,
  };
  sessions.push(session);
  recordAudit({
    actor: assertion.subject,
    tenantId,
    action: 'SSO_SESSION_CREATED',
    target: session.sessionId,
    details: { issuer: assertion.issuer },
  });
  return session;
}

export function findSession(sessionId: string, now = Date.now()): SsoSession | undefined {
  const s = sessions.find((x) => x.sessionId === sessionId);
  if (!s) return undefined;
  if (s.expiresAt < now) return undefined;
  return s;
}

export class EgovSsoIntegrationService {
  constructor(private readonly tenantId: string) {}
  authnRequest(issuer: string, destination: string, acsUrl: string): SamlAuthnRequest {
    return createAuthnRequest(issuer, destination, acsUrl);
  }
  validate(assertion: SamlAssertion, expectedAudience: string) {
    return validateAssertion(assertion, expectedAudience);
  }
  session(assertion: SamlAssertion, duration = 900_000): SsoSession {
    return createSession(this.tenantId, assertion, duration);
  }
  find(sessionId: string): SsoSession | undefined {
    return findSession(sessionId);
  }
  getAuditLog(): readonly SsoAuditEntry[] {
    return getSsoAuditLog(this.tenantId);
  }
}

export { computeSignatureStub as _signStub };
