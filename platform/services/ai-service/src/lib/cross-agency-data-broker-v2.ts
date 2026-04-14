// Design Ref: SVC-AI-ADV-R653.design.md — AI기반 기관 간 데이터 브로커 v2
// Plan SC: FR-R653.1~5

import { createHash } from 'crypto';

export type BrokerDecision = 'ALLOW' | 'MASK' | 'DENY';

interface ExchangeRequest {
  requestId: string;
  fromAgency: string;
  toAgency: string;
  requesterEmail: string;
  fields: string[];
}
interface BrokerResult {
  requestId: string;
  maskedRequester: string;
  decision: BrokerDecision;
  sensitiveFields: string[];
  blockedFields: string[];
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const BLOCKED_FIELDS = new Set(['ssn', 'password', 'creditCard']);
const SENSITIVE_FIELDS = new Set(['residentId', 'phone', 'email', 'address', 'birthDate']);

export class CrossAgencyDataBrokerV2 {
  private auditLog: AuditEntry[] = [];

  request(exchange: ExchangeRequest, dataGrade?: string): BrokerResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const maskedRequester = createHash('sha256')
      .update(exchange.requesterEmail)
      .digest('hex')
      .slice(0, 16);

    const blockedFields = exchange.fields.filter((f) => BLOCKED_FIELDS.has(f));
    const sensitiveFields = exchange.fields.filter((f) => SENSITIVE_FIELDS.has(f));

    let decision: BrokerDecision;
    if (blockedFields.length > 0) decision = 'DENY';
    else if (exchange.fromAgency === exchange.toAgency) decision = 'ALLOW';
    else if (sensitiveFields.length > 0) decision = 'MASK';
    else decision = 'ALLOW';

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'BROKER_REQUEST',
      details: {
        requestId: exchange.requestId,
        fromAgency: exchange.fromAgency,
        toAgency: exchange.toAgency,
        decision,
        maskedRequester,
      },
    });
    return {
      requestId: exchange.requestId,
      maskedRequester,
      decision,
      sensitiveFields,
      blockedFields,
    };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
