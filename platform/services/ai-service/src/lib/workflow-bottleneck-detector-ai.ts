// Design Ref: §SVC-AI-ADV-R517 — AI기반 공공기관 업무 병목 탐지
// Plan SC: FR-R517.1~5

export type StepStatus = 'BOTTLENECK' | 'WARNING' | 'NORMAL';
export type BottleneckSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NONE';

export interface WorkflowStep {
  readonly stepId: string;
  readonly name: string;
  readonly avgDurationMin: number;
  readonly expectedDurationMin: number;
  readonly queueSize: number;
}

export interface StepAnalysis {
  readonly stepId: string;
  readonly status: StepStatus;
  readonly severity: BottleneckSeverity;
}

export interface WorkflowReport {
  readonly steps: readonly StepAnalysis[];
  readonly healthScore: number;
  readonly criticalSteps: readonly string[];
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class WorkflowBottleneckDetectorAI {
  private readonly auditLog: AuditEvent[] = [];

  detect(steps: readonly WorkflowStep[]): WorkflowReport {
    const analyses: StepAnalysis[] = steps.map(step => {
      const ratio = step.avgDurationMin / step.expectedDurationMin;
      const status: StepStatus =
        ratio > 1.5 ? 'BOTTLENECK' : ratio > 1.2 ? 'WARNING' : 'NORMAL';

      const isCritical =
        step.avgDurationMin > step.expectedDurationMin * 2 || step.queueSize > 50;
      const severity: BottleneckSeverity =
        isCritical
          ? 'CRITICAL'
          : status === 'BOTTLENECK'
          ? 'HIGH'
          : status === 'WARNING'
          ? 'MEDIUM'
          : 'NONE';

      return { stepId: step.stepId, status, severity };
    });

    const normalCount = analyses.filter(a => a.status === 'NORMAL').length;
    const healthScore =
      steps.length === 0 ? 100 : Math.round((normalCount / steps.length) * 100);
    const criticalSteps = analyses
      .filter(a => a.severity === 'CRITICAL')
      .map(a => a.stepId);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'workflow.detect',
      details: {
        stepCount: steps.length,
        bottleneckCount: analyses.filter(a => a.status === 'BOTTLENECK').length,
        criticalCount: criticalSteps.length,
        healthScore,
      },
    });

    return { steps: analyses, healthScore, criticalSteps };
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
