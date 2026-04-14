// Design Ref: SVC-AI-ADV-R693.design.md — AI기반 컨텍스트 인식 접근 제어 v3
// Plan SC: FR-R693.1~5

import { createHash } from 'crypto';

export type AccessDecision = 'ALLOW' | 'CHALLENGE' | 'DENY';

interface AccessPolicy {
  policyId: string;
  resource: string;
  minTrust: number;
}
interface AccessRequest {
  resource: string;
  userId: string;
  deviceTrust: number;
  locationTrust: number;
  timeTrust: number;
}
interface AccessVerdict {
  resource: string;
  trust: number;
  decision: AccessDecision;
  maskedUserId: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class ContextAwareAccessControlV3 {
  private policies = new Map<string, AccessPolicy>();
  private auditLog: AuditEntry[] = [];

  registerPolicy(policy: AccessPolicy): void {
    if (policy.minTrust < 0 || policy.minTrust > 1) {
      throw new Error('INVALID_TRUST_THRESHOLD');
    }
    this.policies.set(policy.resource, policy);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_POLICY',
      details: { policyId: policy.policyId, resource: policy.resource },
    });
  }

  evaluate(req: AccessRequest, dataGrade?: string): AccessVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const policy = this.policies.get(req.resource);
    if (!policy) {
      throw new Error(`UNKNOWN_RESOURCE: ${req.resource}`);
    }
    for (const v of [req.deviceTrust, req.locationTrust, req.timeTrust]) {
      if (v < 0 || v > 1) {
        throw new Error('INVALID_TRUST_INPUT');
      }
    }

    const trust = req.deviceTrust * 0.4 + req.locationTrust * 0.3 + req.timeTrust * 0.3;
    let decision: AccessDecision;
    if (trust >= policy.minTrust) decision = 'ALLOW';
    else if (trust >= policy.minTrust * 0.6) decision = 'CHALLENGE';
    else decision = 'DENY';

    const maskedUserId = maskPII(req.userId);
    const verdict: AccessVerdict = {
      resource: req.resource,
      trust,
      decision,
      maskedUserId,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'EVALUATE_ACCESS',
      details: { resource: req.resource, trust, decision, maskedUserId },
    });
    return verdict;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
