// SVC-AI-ADV-R402 Federated Identity Manager AI
// Design Ref: SVC-AI-ADV-R402.design.md
// Plan SC: SC-R402-1~5
// CSAP D-08 / N2SF N-01

export interface FederatedToken {
  readonly issuer: string;
  readonly subject: string;
  readonly role: string;
  readonly expiry: string; // ISO8601
}

export interface VerifyResult {
  readonly valid: boolean;
  readonly reason: string;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class FederatedIdentityManagerAI {
  private readonly trustedIssuers = new Set<string>();
  private readonly roleMapping = new Map<string, readonly string[]>();
  private readonly auditLog: AuditEntry[] = [];

  registerIssuer(issuer: string): void {
    if (!issuer) throw new Error('INVALID_ISSUER');
    this.trustedIssuers.add(issuer);
    this.record('REGISTER_ISSUER', issuer, {});
  }

  registerRoleMapping(sourceRole: string, targetRoles: readonly string[]): void {
    if (!sourceRole || targetRoles.length === 0) {
      throw new Error('INVALID_MAPPING');
    }
    this.roleMapping.set(sourceRole, [...targetRoles]);
    this.record('REGISTER_MAPPING', sourceRole, { targets: targetRoles.length });
  }

  verifyToken(token: FederatedToken, now: Date = new Date()): VerifyResult {
    if (!this.trustedIssuers.has(token.issuer)) {
      this.record('VERIFY_FAIL', token.issuer, { reason: 'UNTRUSTED_ISSUER' });
      return { valid: false, reason: 'UNTRUSTED_ISSUER' };
    }
    const expMs = Date.parse(token.expiry);
    if (Number.isNaN(expMs)) {
      this.record('VERIFY_FAIL', token.issuer, { reason: 'INVALID_EXPIRY' });
      return { valid: false, reason: 'INVALID_EXPIRY' };
    }
    if (expMs <= now.getTime()) {
      this.record('VERIFY_FAIL', token.issuer, { reason: 'EXPIRED' });
      return { valid: false, reason: 'EXPIRED' };
    }
    this.record('VERIFY_OK', token.issuer, { subject: token.subject });
    return { valid: true, reason: 'OK' };
  }

  propagatePermissions(sourceRole: string): readonly string[] {
    const target = this.roleMapping.get(sourceRole);
    const result = target ?? ['guest'];
    this.record('PROPAGATE', sourceRole, { roles: result.length });
    return result;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
