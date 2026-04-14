// Design Ref: §SVC-AI-ADV-R481 — AI기반 멀티테넌트 보안 감사 v2
// Plan SC: FR-R481.1~5

export type ViolationType = 'CROSS_TENANT_ACCESS' | 'UNAUTHORIZED_ACTION' | 'NONE';
export type Severity = 'CRITICAL' | 'HIGH' | 'LOW';

export interface AccessLog {
  readonly logId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly resource: string;
  readonly action: string;
  readonly targetTenantId?: string;
}

export interface AuditFinding {
  readonly logId: string;
  readonly violation: ViolationType;
  readonly severity: Severity;
  readonly maskedUserId: string;
}

export interface SecurityAuditReport {
  readonly total: number;
  readonly violations: number;
  readonly findings: readonly AuditFinding[];
}

const PRIVILEGED_ACTIONS = new Set(['DELETE', 'ADMIN', 'EXPORT']);

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class MultitenantSecurityAuditorV2 {
  private readonly auditLog: AuditEvent[] = [];

  private maskUserId(userId: string): string {
    if (userId.length < 4) return '***';
    return userId.slice(0, 2) + '*'.repeat(userId.length - 4) + userId.slice(-2);
  }

  audit(logs: readonly AccessLog[]): SecurityAuditReport {
    const findings: AuditFinding[] = [];

    for (const log of logs) {
      const maskedUserId = this.maskUserId(log.userId);

      if (log.targetTenantId && log.targetTenantId !== log.tenantId) {
        findings.push({
          logId: log.logId,
          violation: 'CROSS_TENANT_ACCESS',
          severity: 'CRITICAL',
          maskedUserId,
        });
      } else if (PRIVILEGED_ACTIONS.has(log.action.toUpperCase())) {
        findings.push({
          logId: log.logId,
          violation: 'UNAUTHORIZED_ACTION',
          severity: 'HIGH',
          maskedUserId,
        });
      }
      // NONE violations are not added to findings
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'security.audit',
      details: {
        total: logs.length,
        violations: findings.length,
        criticalCount: findings.filter(f => f.severity === 'CRITICAL').length,
      },
    });

    return {
      total: logs.length,
      violations: findings.length,
      findings,
    };
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
