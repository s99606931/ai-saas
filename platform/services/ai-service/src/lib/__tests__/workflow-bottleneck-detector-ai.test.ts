import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowBottleneckDetectorAI, type WorkflowStep } from '../workflow-bottleneck-detector-ai';

describe('WorkflowBottleneckDetectorAI', () => {
  let detector: WorkflowBottleneckDetectorAI;

  beforeEach(() => {
    detector = new WorkflowBottleneckDetectorAI();
  });

  it('marks BOTTLENECK when avg > expected * 1.5', () => {
    const steps: WorkflowStep[] = [
      { stepId: 'S1', name: 'Review', avgDurationMin: 16, expectedDurationMin: 10, queueSize: 5 },
    ];
    const report = detector.detect(steps);
    expect(report.steps[0]!.status).toBe('BOTTLENECK');
    expect(report.steps[0]!.severity).toBe('HIGH');
  });

  it('marks WARNING when avg > expected * 1.2 but <= 1.5', () => {
    const steps: WorkflowStep[] = [
      { stepId: 'S2', name: 'Approval', avgDurationMin: 13, expectedDurationMin: 10, queueSize: 5 },
    ];
    const report = detector.detect(steps);
    expect(report.steps[0]!.status).toBe('WARNING');
    expect(report.steps[0]!.severity).toBe('MEDIUM');
  });

  it('marks NORMAL for on-time step', () => {
    const steps: WorkflowStep[] = [
      { stepId: 'S3', name: 'Submit', avgDurationMin: 5, expectedDurationMin: 10, queueSize: 2 },
    ];
    const report = detector.detect(steps);
    expect(report.steps[0]!.status).toBe('NORMAL');
    expect(report.steps[0]!.severity).toBe('NONE');
  });

  it('marks CRITICAL when avg > expected*2', () => {
    const steps: WorkflowStep[] = [
      { stepId: 'S4', name: 'Process', avgDurationMin: 25, expectedDurationMin: 10, queueSize: 10 },
    ];
    const report = detector.detect(steps);
    expect(report.steps[0]!.severity).toBe('CRITICAL');
    expect(report.criticalSteps).toContain('S4');
  });

  it('marks CRITICAL when queueSize>50', () => {
    const steps: WorkflowStep[] = [
      { stepId: 'S5', name: 'Queue', avgDurationMin: 12, expectedDurationMin: 10, queueSize: 60 },
    ];
    const report = detector.detect(steps);
    expect(report.steps[0]!.severity).toBe('CRITICAL');
  });

  it('computes healthScore as percentage of NORMAL steps', () => {
    const steps: WorkflowStep[] = [
      { stepId: 'S6', name: 'A', avgDurationMin: 5, expectedDurationMin: 10, queueSize: 0 },
      { stepId: 'S7', name: 'B', avgDurationMin: 20, expectedDurationMin: 10, queueSize: 5 },
    ];
    const report = detector.detect(steps);
    expect(report.healthScore).toBe(50);
  });

  it('records audit log', () => {
    detector.detect([
      { stepId: 'S8', name: 'X', avgDurationMin: 5, expectedDurationMin: 10, queueSize: 0 },
    ]);
    const log = detector.getAuditLog();
    expect(log[0]!.action).toBe('workflow.detect');
  });
});
