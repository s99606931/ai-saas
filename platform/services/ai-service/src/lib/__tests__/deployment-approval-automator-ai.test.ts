import { describe, it, expect, beforeEach } from 'vitest';
import { DeploymentApprovalAutomatorAI, type DeployRequest } from '../deployment-approval-automator-ai';

describe('DeploymentApprovalAutomatorAI', () => {
  let automator: DeploymentApprovalAutomatorAI;

  beforeEach(() => {
    automator = new DeploymentApprovalAutomatorAI();
  });

  it('AUTO_APPROVE for low risk dev deployment', () => {
    const requests: DeployRequest[] = [
      { deployId: 'D1', service: 'auth', environment: 'dev', testsPassed: true, changedFiles: 5, hasRollbackPlan: true },
    ];
    const result = automator.evaluate(requests);
    // env=0+tests=0+files=0+rollback=0 = 0 < 30 → AUTO_APPROVE
    expect(result[0]!.decision).toBe('AUTO_APPROVE');
    expect(result[0]!.riskScore).toBe(0);
  });

  it('REJECT for high-risk prod deployment without tests', () => {
    const requests: DeployRequest[] = [
      { deployId: 'D2', service: 'api', environment: 'prod', testsPassed: false, changedFiles: 25, hasRollbackPlan: false },
    ];
    const result = automator.evaluate(requests);
    // prod=40+noTests=30+files>20=20+noRollback=15 = 105 ≥ 60 → REJECT
    expect(result[0]!.decision).toBe('REJECT');
    expect(result[0]!.riskScore).toBeGreaterThanOrEqual(60);
  });

  it('MANUAL_REVIEW for stg deployment with tests failed', () => {
    const requests: DeployRequest[] = [
      { deployId: 'D3', service: 'svc', environment: 'stg', testsPassed: false, changedFiles: 5, hasRollbackPlan: true },
    ];
    const result = automator.evaluate(requests);
    // stg=10+noTests=30 = 40, 30<=40<60 → MANUAL_REVIEW
    expect(result[0]!.decision).toBe('MANUAL_REVIEW');
  });

  it('includes reasons for risk factors', () => {
    const requests: DeployRequest[] = [
      { deployId: 'D4', service: 'svc', environment: 'prod', testsPassed: true, changedFiles: 5, hasRollbackPlan: true },
    ];
    const result = automator.evaluate(requests);
    expect(result[0]!.reasons).toContain('production_deployment');
  });

  it('adds no_rollback_plan reason when missing rollback', () => {
    const requests: DeployRequest[] = [
      { deployId: 'D5', service: 'svc', environment: 'dev', testsPassed: true, changedFiles: 5, hasRollbackPlan: false },
    ];
    const result = automator.evaluate(requests);
    expect(result[0]!.reasons).toContain('no_rollback_plan');
  });

  it('records audit log', () => {
    automator.evaluate([
      { deployId: 'D6', service: 'svc', environment: 'dev', testsPassed: true, changedFiles: 3, hasRollbackPlan: true },
    ]);
    const log = automator.getAuditLog();
    expect(log[0]!.action).toBe('deployment.evaluate');
  });
});
