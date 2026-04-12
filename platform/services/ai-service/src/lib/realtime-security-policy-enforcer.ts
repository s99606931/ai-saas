// Design Ref: §핵심 알고리즘 — 우선순위 기반 정책 평가
// Plan SC: FR-R279.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type PolicyAction = 'block' | 'warn' | 'allow';

interface SecurityPolicy {
  id: string;
  name: string;
  conditions: Record<string, unknown>;
  action: PolicyAction;
  priority: number;
}

interface EvaluationResult {
  matched: boolean;
  policyId: string | null;
  action: PolicyAction | 'none';
  reason: string;
}

interface ViolationRecord {
  policyId: string;
  policyName: string;
  action: PolicyAction;
  request: Record<string, unknown>;
  recordedAt: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R279.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

function matchesConditions(request: Record<string, unknown>, conditions: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(conditions)) {
    if (request[key] !== value) return false;
  }
  return true;
}

export class RealtimeSecurityPolicyEnforcer {
  private policies = new Map<string, SecurityPolicy>();
  private violations: ViolationRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R279.1
  registerPolicy(id: string, name: string, conditions: Record<string, unknown>, action: PolicyAction, priority: number = 0): void {
    this.policies.set(id, { id, name, conditions, action, priority });
    this.log('REGISTER_POLICY', { id, name, action, priority });
  }

  // Plan SC: FR-R279.2 + R279.4
  evaluate(request: Record<string, unknown>, grade: DataGrade = DataGrade.O): EvaluationResult {
    guardDataGrade(grade);

    const sorted = Array.from(this.policies.values()).sort((a, b) => b.priority - a.priority);

    for (const policy of sorted) {
      if (matchesConditions(request, policy.conditions)) {
        if (policy.action === 'block' || policy.action === 'warn') {
          this.violations.push({
            policyId: policy.id,
            policyName: policy.name,
            action: policy.action,
            request,
            recordedAt: new Date().toISOString(),
          });
        }
        this.log('EVALUATE', { policyId: policy.id, action: policy.action });
        return {
          matched: true,
          policyId: policy.id,
          action: policy.action,
          reason: `정책 "${policy.name}" 매칭`,
        };
      }
    }

    return { matched: false, policyId: null, action: 'none', reason: '매칭 정책 없음' };
  }

  // Plan SC: FR-R279.3
  getViolationHistory(policyId?: string): ViolationRecord[] {
    if (policyId) return this.violations.filter(v => v.policyId === policyId);
    return [...this.violations];
  }

  // Plan SC: FR-R279.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
