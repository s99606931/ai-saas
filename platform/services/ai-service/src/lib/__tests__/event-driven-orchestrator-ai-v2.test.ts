import { describe, it, expect, beforeEach } from 'vitest';
import { EventDrivenOrchestratorAIV2 } from '../event-driven-orchestrator-ai-v2';

describe('EventDrivenOrchestratorAIV2', () => {
  let orch: EventDrivenOrchestratorAIV2;

  beforeEach(() => {
    orch = new EventDrivenOrchestratorAIV2();
    orch.defineWorkflow('wf1', [
      { stepId: 's1', expectedMs: 100 },
      { stepId: 's2', expectedMs: 200 },
    ]);
  });

  it('defines workflow and rejects empty steps', () => {
    expect(() => orch.defineWorkflow('wf2', [])).toThrow('EMPTY_STEPS');
  });

  it('handles event for known workflow', () => {
    orch.handleEvent('wf1', 'start');
    expect(orch.getAuditLog().some((e) => e.action === 'HANDLE_EVENT')).toBe(true);
  });

  it('blocks C/S grade event (N2SF N-05)', () => {
    expect(() => orch.handleEvent('wf1', 'start', 'C')).toThrow('BLOCKED');
    expect(() => orch.handleEvent('wf1', 'start', 'S')).toThrow('BLOCKED');
  });

  it('rejects unknown workflow', () => {
    expect(() => orch.handleEvent('unknown', 'start')).toThrow('UNKNOWN_WORKFLOW');
  });

  it('detects delayed steps (> 1.5x expected)', () => {
    orch.recordStep('wf1', 's1', 90, 'DONE');
    orch.recordStep('wf1', 's2', 400, 'DONE');
    const delayed = orch.getDelayedSteps('wf1');
    expect(delayed).toHaveLength(1);
    expect(delayed[0]!.stepId).toBe('s2');
  });

  it('records audit log for recordStep', () => {
    orch.recordStep('wf1', 's1', 50, 'DONE');
    expect(orch.getAuditLog().some((e) => e.action === 'RECORD_STEP')).toBe(true);
  });
});
