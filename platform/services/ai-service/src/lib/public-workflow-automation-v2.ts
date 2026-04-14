// Design Ref: §자동화점수 — repetitionRate×40+min(steps/10,1)×30+min(duration/60,1)×20+(errorProne?10:0)
// Plan SC: SC-R540-1, SC-R540-2, SC-R540-3

interface WorkflowInput {
  taskId: string;
  name: string;
  repetitionRate: number;
  manualSteps: number;
  avgDurationMin: number;
  errorProne: boolean;
}

type AutomationRecommendation = 'AUTOMATE' | 'SEMI_AUTOMATE' | 'MANUAL';

interface AutomationResult {
  taskId: string;
  name: string;
  automationScore: number;
  recommendation: AutomationRecommendation;
  estimatedTimeSavingsMin: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  taskId: string;
  automationScore: number;
  recommendation: AutomationRecommendation;
}

export class PublicWorkflowAutomationV2 {
  private readonly auditLog: AuditEntry[] = [];

  evaluate(input: WorkflowInput): AutomationResult {
    const { taskId, name, repetitionRate, manualSteps, avgDurationMin, errorProne } = input;

    const automationScore =
      repetitionRate * 40 +
      Math.min(manualSteps / 10, 1) * 30 +
      Math.min(avgDurationMin / 60, 1) * 20 +
      (errorProne ? 10 : 0);

    const recommendation = this.classifyRecommendation(automationScore);
    const estimatedTimeSavingsMin = Math.round(avgDurationMin * repetitionRate * 0.8 * 100) / 100;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'WORKFLOW_EVALUATED',
      taskId,
      automationScore: Math.round(automationScore * 100) / 100,
      recommendation,
    });

    return {
      taskId,
      name,
      automationScore: Math.round(automationScore * 100) / 100,
      recommendation,
      estimatedTimeSavingsMin,
    };
  }

  private classifyRecommendation(score: number): AutomationRecommendation {
    if (score >= 70) return 'AUTOMATE';
    if (score >= 40) return 'SEMI_AUTOMATE';
    return 'MANUAL';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
