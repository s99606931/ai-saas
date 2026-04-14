// Design Ref: SVC-AI-ADV-R694.design.md — AI기반 서비스 메시 서킷브레이커 v2
// Plan SC: FR-R694.1~5

import { createHash } from 'crypto';

export type CircuitState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

interface ServiceConfig {
  serviceId: string;
  failureThreshold: number;
}
interface CallRecord {
  serviceId: string;
  callerId: string;
  success: boolean;
}
interface CircuitVerdict {
  serviceId: string;
  failureRate: number;
  state: CircuitState;
  maskedCallerId: string;
}
interface ServiceCounters {
  total: number;
  failures: number;
  threshold: number;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class ServiceMeshCircuitBreakerAIV2 {
  private services = new Map<string, ServiceCounters>();
  private auditLog: AuditEntry[] = [];

  registerService(svc: ServiceConfig): void {
    if (svc.failureThreshold <= 0 || svc.failureThreshold > 1) {
      throw new Error('INVALID_THRESHOLD');
    }
    this.services.set(svc.serviceId, { total: 0, failures: 0, threshold: svc.failureThreshold });
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_SERVICE',
      details: { serviceId: svc.serviceId, threshold: svc.failureThreshold },
    });
  }

  recordCall(call: CallRecord, dataGrade?: string): CircuitVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const counters = this.services.get(call.serviceId);
    if (!counters) {
      throw new Error(`UNKNOWN_SERVICE: ${call.serviceId}`);
    }
    counters.total += 1;
    if (!call.success) counters.failures += 1;

    const failureRate = counters.failures / counters.total;
    let state: CircuitState;
    if (failureRate >= counters.threshold) state = 'OPEN';
    else if (failureRate >= counters.threshold / 2) state = 'HALF_OPEN';
    else state = 'CLOSED';

    const maskedCallerId = maskPII(call.callerId);
    const verdict: CircuitVerdict = {
      serviceId: call.serviceId,
      failureRate,
      state,
      maskedCallerId,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_CALL',
      details: { serviceId: call.serviceId, failureRate, state, maskedCallerId },
    });
    return verdict;
  }

  getOpenCircuits(): string[] {
    const result: string[] = [];
    for (const [id, c] of this.services.entries()) {
      if (c.total > 0 && c.failures / c.total >= c.threshold) result.push(id);
    }
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
