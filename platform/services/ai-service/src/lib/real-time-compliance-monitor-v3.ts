// Design Ref: SVC-AI-ADV-R674.design.md — AI기반 실시간 컴플라이언스 모니터링 v3
// Plan SC: FR-R674.1~5

export type ViolationLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type ComplianceAction = 'LOG' | 'ALERT' | 'BLOCK';

interface CompliancePolicy { policyId: string; name: string; severity: 'HIGH' | 'MEDIUM' | 'LOW' }
interface ComplianceEvent {
  eventId: string;
  policyId: string;
  violationScore: number;
}
interface ComplianceVerdict {
  eventId: string;
  policyId: string;
  level: ViolationLevel;
  action: ComplianceAction;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const ACTION_RANK: ComplianceAction[] = ['LOG', 'ALERT', 'BLOCK'];

function rankToAction(rank: number): ComplianceAction {
  const idx = Math.max(0, Math.min(ACTION_RANK.length - 1, rank));
  return ACTION_RANK[idx]!;
}

export class RealTimeComplianceMonitorV3 {
  private policies = new Map<string, CompliancePolicy>();
  private verdicts: ComplianceVerdict[] = [];
  private auditLog: AuditEntry[] = [];

  registerPolicy(policy: CompliancePolicy): void {
    this.policies.set(policy.policyId, policy);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_POLICY',
      details: { policyId: policy.policyId, name: policy.name, severity: policy.severity },
    });
  }

  evaluateEvent(event: ComplianceEvent, dataGrade?: string): ComplianceVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const policy = this.policies.get(event.policyId);
    if (!policy) {
      throw new Error(`UNKNOWN_POLICY: ${event.policyId}`);
    }
    if (event.violationScore < 0 || event.violationScore > 100) {
      throw new Error('INVALID_SCORE');
    }

    let level: ViolationLevel;
    let baseRank: number;
    if (event.violationScore >= 80) {
      level = 'HIGH';
      baseRank = 2;
    } else if (event.violationScore >= 40) {
      level = 'MEDIUM';
      baseRank = 1;
    } else {
      level = 'LOW';
      baseRank = 0;
    }

    const finalRank = policy.severity === 'HIGH' ? baseRank + 1 : baseRank;
    const action = rankToAction(finalRank);

    const verdict: ComplianceVerdict = {
      eventId: event.eventId,
      policyId: event.policyId,
      level,
      action,
    };
    this.verdicts.push(verdict);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'EVALUATE_EVENT',
      details: { eventId: event.eventId, policyId: event.policyId, level, action },
    });
    return verdict;
  }

  getBlockedEvents(): ComplianceVerdict[] {
    return this.verdicts.filter((v) => v.action === 'BLOCK');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
