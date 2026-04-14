// Design Ref: §SVC-AI-ADV-R515 — AI기반 지능형 배포 승인 자동화
// Plan SC: FR-R515.1~5

export type Environment = 'dev' | 'stg' | 'prod';
export type ApprovalDecision = 'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'REJECT';

export interface DeployRequest {
  readonly deployId: string;
  readonly service: string;
  readonly environment: Environment;
  readonly testsPassed: boolean;
  readonly changedFiles: number;
  readonly hasRollbackPlan: boolean;
}

export interface ApprovalResult {
  readonly deployId: string;
  readonly decision: ApprovalDecision;
  readonly riskScore: number;
  readonly reasons: readonly string[];
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

const ENV_SCORE: Record<Environment, number> = { prod: 40, stg: 10, dev: 0 };

export class DeploymentApprovalAutomatorAI {
  private readonly auditLog: AuditEvent[] = [];

  evaluate(requests: readonly DeployRequest[]): readonly ApprovalResult[] {
    const results: ApprovalResult[] = requests.map(req => {
      let riskScore = ENV_SCORE[req.environment];
      const reasons: string[] = [];

      if (!req.testsPassed) {
        riskScore += 30;
        reasons.push('tests_not_passed');
      }
      if (req.changedFiles > 20) {
        riskScore += 20;
        reasons.push('large_changeset');
      } else if (req.changedFiles > 10) {
        riskScore += 10;
        reasons.push('medium_changeset');
      }
      if (!req.hasRollbackPlan) {
        riskScore += 15;
        reasons.push('no_rollback_plan');
      }
      if (req.environment === 'prod') reasons.push('production_deployment');

      const decision: ApprovalDecision =
        riskScore < 30 ? 'AUTO_APPROVE' : riskScore < 60 ? 'MANUAL_REVIEW' : 'REJECT';

      return { deployId: req.deployId, decision, riskScore, reasons };
    });

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'deployment.evaluate',
      details: {
        requestCount: requests.length,
        autoApproved: results.filter(r => r.decision === 'AUTO_APPROVE').length,
        rejected: results.filter(r => r.decision === 'REJECT').length,
      },
    });

    return results;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
