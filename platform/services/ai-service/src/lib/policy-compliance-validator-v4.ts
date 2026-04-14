// Design Ref: SVC-AI-ADV-R705.design.md — AI기반 정책 준수 검증 v4
// Plan SC: FR-R705.1~5

import { createHash } from 'crypto';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

interface Policy {
  policyId: string;
  attribute: string;
  allowedValues: string[];
  severity: Severity;
}
interface ResourceInput {
  resourceId: string;
  attrs: Record<string, string>;
}
interface Violation {
  maskedResourceId: string;
  policyId: string;
  severity: Severity;
  actual: string;
}
interface EvaluationResult {
  maskedResourceId: string;
  violations: Violation[];
  riskScore: number;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const SEVERITY_SCORE: Record<Severity, number> = { LOW: 1, MEDIUM: 3, HIGH: 9 };
const SEVERITY_RANK: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

function maskId(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class PolicyComplianceValidatorV4 {
  private policies = new Map<string, Policy>();
  private violations: Violation[] = [];
  private auditLog: AuditEntry[] = [];

  registerPolicy(policy: Policy): void {
    if (!policy.policyId || !policy.attribute) throw new Error('INVALID_POLICY');
    if (policy.allowedValues.length === 0) throw new Error('EMPTY_ALLOWED_VALUES');
    this.policies.set(policy.policyId, policy);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_POLICY',
      details: { policyId: policy.policyId, severity: policy.severity },
    });
  }

  evaluate(resource: ResourceInput, dataGrade?: string): EvaluationResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (this.policies.size === 0) throw new Error('NO_POLICIES');
    const masked = maskId(resource.resourceId);
    const found: Violation[] = [];
    let riskScore = 0;
    for (const policy of this.policies.values()) {
      const actual = resource.attrs[policy.attribute];
      if (actual === undefined || !policy.allowedValues.includes(actual)) {
        const v: Violation = {
          maskedResourceId: masked,
          policyId: policy.policyId,
          severity: policy.severity,
          actual: actual ?? '<missing>',
        };
        found.push(v);
        this.violations.push(v);
        riskScore += SEVERITY_SCORE[policy.severity];
      }
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'EVALUATE',
      details: { maskedResourceId: masked, violationCount: found.length, riskScore },
    });
    return { maskedResourceId: masked, violations: found, riskScore };
  }

  listViolations(): Violation[] {
    return [...this.violations].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
