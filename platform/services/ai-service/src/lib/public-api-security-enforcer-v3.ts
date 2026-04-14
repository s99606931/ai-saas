// Design Ref: SVC-AI-ADV-R698.design.md — AI기반 공공 API 보안 강제화 v3
// Plan SC: FR-R698.1~5

import { createHash } from 'crypto';

export type EnforcerDecision = 'ALLOW' | 'WARN' | 'BLOCK';

interface ApiPolicy {
  apiId: string;
  requireAuth: boolean;
  maxRps: number;
}
interface ApiRequestEval {
  apiId: string;
  clientId: string;
  hasAuth: boolean;
  rps: number;
  tls: boolean;
}
interface EnforcerVerdict {
  apiId: string;
  violationScore: number;
  decision: EnforcerDecision;
  maskedClientId: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class PublicApiSecurityEnforcerV3 {
  private policies = new Map<string, ApiPolicy>();
  private auditLog: AuditEntry[] = [];

  registerPolicy(policy: ApiPolicy): void {
    if (policy.maxRps <= 0) {
      throw new Error('INVALID_RPS');
    }
    this.policies.set(policy.apiId, policy);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_POLICY',
      details: { apiId: policy.apiId, requireAuth: policy.requireAuth, maxRps: policy.maxRps },
    });
  }

  evaluateRequest(req: ApiRequestEval, dataGrade?: string): EnforcerVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const policy = this.policies.get(req.apiId);
    if (!policy) {
      throw new Error(`UNKNOWN_API: ${req.apiId}`);
    }

    let violationScore = 0;
    if (policy.requireAuth && !req.hasAuth) violationScore += 50;
    if (req.rps > policy.maxRps) violationScore += 30;
    if (!req.tls) violationScore += 20;

    let decision: EnforcerDecision;
    if (violationScore >= 70) decision = 'BLOCK';
    else if (violationScore >= 30) decision = 'WARN';
    else decision = 'ALLOW';

    const maskedClientId = maskPII(req.clientId);
    const verdict: EnforcerVerdict = {
      apiId: req.apiId,
      violationScore,
      decision,
      maskedClientId,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'EVALUATE_REQUEST',
      details: { apiId: req.apiId, violationScore, decision, maskedClientId },
    });
    return verdict;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
