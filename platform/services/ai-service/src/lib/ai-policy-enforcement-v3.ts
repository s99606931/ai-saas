// Design Ref: SVC-AI-ADV-R601-v3.design.md §알고리즘
// Plan SC: SC-R601v3-1, SC-R601v3-2, SC-R601v3-3
// 트랙 A 22차

import { createHash } from 'crypto';

export interface PolicyRequest {
  id: string;
  grade: 'C' | 'S' | 'O';
  actorEmail: string;
  action: 'READ' | 'WRITE' | 'DELETE';
  resource: string;
  attemptCount: number;
}

export interface PolicyResult {
  id: string;
  allowed: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  maskedActor: string;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class AiPolicyEnforcementV3 {
  private readonly auditLog: AuditEntry[] = [];

  enforce(req: PolicyRequest): PolicyResult {
    if (req.grade === 'C' || req.grade === 'S') {
      throw new Error('BLOCKED: C/S등급 AI API 전송 금지 (N2SF N-05)');
    }

    const maskedActor = maskPII(req.actorEmail);

    let severity: PolicyResult['severity'] = 'LOW';
    let allowed = true;
    let reason = 'POLICY_OK';

    if (req.action === 'DELETE' && req.resource === 'production') {
      severity = 'CRITICAL';
      allowed = false;
      reason = 'PRODUCTION_DELETE_BLOCKED';
    } else if (req.attemptCount > 5) {
      severity = 'HIGH';
      allowed = false;
      reason = 'ATTEMPT_LIMIT_EXCEEDED';
    }

    const result: PolicyResult = {
      id: req.id,
      allowed,
      severity,
      reason,
      maskedActor,
    };

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ENFORCE',
      actor: maskedActor,
      details: { id: req.id, severity, allowed, reason },
    });

    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
