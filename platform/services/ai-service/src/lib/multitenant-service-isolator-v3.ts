// Design Ref: §격리위반 — requestTenantId!==resourceTenantId → 위험도 분류 → ALLOW/DENY
// Plan SC: SC-R545-1, SC-R545-2, SC-R545-3

interface IsolationInput {
  requestTenantId: string;
  resourceTenantId: string;
  resourceType: string;
  action: string;
  requesterId: string;
}

type RiskLevel = 'SAFE' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type IsolationDecision = 'ALLOW' | 'DENY';

interface IsolationResult {
  requestTenantId: string;
  resourceTenantId: string;
  riskLevel: RiskLevel;
  decision: IsolationDecision;
  requesterIdMasked: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  requestTenantId: string;
  resourceTenantId: string;
  riskLevel: RiskLevel;
  decision: IsolationDecision;
  requesterIdMasked: string;
}

export class MultitenantServiceIsolatorV3 {
  private readonly auditLog: AuditEntry[] = [];

  check(input: IsolationInput): IsolationResult {
    const { requestTenantId, resourceTenantId, action, requesterId } = input;

    const isViolation = requestTenantId !== resourceTenantId;
    const riskLevel = this.classifyRisk(isViolation, action);
    const decision: IsolationDecision = riskLevel === 'SAFE' ? 'ALLOW' : 'DENY';
    const requesterIdMasked = this.maskId(requesterId);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ISOLATION_CHECKED',
      requestTenantId,
      resourceTenantId,
      riskLevel,
      decision,
      requesterIdMasked,
    });

    return { requestTenantId, resourceTenantId, riskLevel, decision, requesterIdMasked };
  }

  private classifyRisk(isViolation: boolean, action: string): RiskLevel {
    if (!isViolation) return 'SAFE';
    if (action === 'DELETE') return 'CRITICAL';
    if (action === 'WRITE') return 'HIGH';
    return 'MEDIUM';
  }

  private maskId(id: string): string {
    if (id.length < 4) return '***';
    return id.slice(0, 2) + '***' + id.slice(-2);
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
