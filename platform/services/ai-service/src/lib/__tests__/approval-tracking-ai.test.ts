// MTU-N382 결재 추적 AI 테스트
import { describe, it, expect } from 'vitest';
import { ApprovalTrackingAiService } from '../approval-tracking-ai.js';

describe('MTU-N382 ApprovalTrackingAi', () => {
  const svc = new ApprovalTrackingAiService('tenant-n382');

  it('FR-N382.1: 결재 흐름 생성 및 진행', () => {
    const flow = svc.create('f-1', 'doc-1', [
      { stepId: 's1', approverId: 'a1', order: 1, slaMinutes: 60 },
      { stepId: 's2', approverId: 'a2', order: 2, slaMinutes: 60 },
    ]);
    svc.advance(flow, 's1', true);
    expect(flow.steps[0]?.status).toBe('approved');
    expect(flow.steps[1]?.status).toBe('in_review');
  });

  it('FR-N382.2: 지연 탐지', () => {
    const flow = svc.create('f-2', 'doc-2', [
      { stepId: 's1', approverId: 'a1', order: 1, slaMinutes: 1 },
    ]);
    flow.steps[0]!.status = 'in_review';
    flow.steps[0]!.startedAt = Date.now() - 10 * 60_000;
    const delayed = svc.detectDelayed(flow);
    expect(delayed.length).toBeGreaterThan(0);
  });

  it('FR-N382.3: 에스컬레이션', () => {
    const flow = svc.create('f-3', 'doc-3', [
      { stepId: 's1', approverId: 'a1', order: 1, slaMinutes: 1 },
    ]);
    flow.steps[0]!.status = 'in_review';
    flow.steps[0]!.startedAt = Date.now() - 10 * 60_000;
    const escalated = svc.escalate(flow, [{ overdueMinutes: 5, escalateTo: 'boss' }]);
    expect(escalated.length).toBeGreaterThan(0);
  });

  it('FR-N382.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
