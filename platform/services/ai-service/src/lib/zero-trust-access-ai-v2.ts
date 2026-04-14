// Design Ref: SVC-AI-ADV-R648.design.md — AI기반 제로 트러스트 접근 제어 v2
// Plan SC: FR-R648.1~5

import { createHash } from 'crypto';

export type AccessDecision = 'ALLOW' | 'CHALLENGE' | 'DENY';

interface AccessRequest {
  requestId: string;
  userId: string;
  knownDevice: boolean;
  offHours: boolean;
  newLocation: boolean;
  failedAttempts: number;
  resource: string;
}
interface AccessResult {
  requestId: string;
  maskedUserId: string;
  riskScore: number;
  decision: AccessDecision;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ZeroTrustAccessAIV2 {
  private auditLog: AuditEntry[] = [];

  evaluate(req: AccessRequest, dataGrade?: string): AccessResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const maskedUserId = createHash('sha256').update(req.userId).digest('hex').slice(0, 16);
    let riskScore = 0;
    if (!req.knownDevice) riskScore += 40;
    if (req.offHours) riskScore += 20;
    if (req.newLocation) riskScore += 20;
    riskScore += Math.max(0, req.failedAttempts) * 5;
    if (riskScore > 100) riskScore = 100;

    let decision: AccessDecision;
    if (riskScore < 30) decision = 'ALLOW';
    else if (riskScore < 70) decision = 'CHALLENGE';
    else decision = 'DENY';

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'EVALUATE_ACCESS',
      details: { requestId: req.requestId, maskedUserId, riskScore, decision, resource: req.resource },
    });
    return { requestId: req.requestId, maskedUserId, riskScore, decision };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
