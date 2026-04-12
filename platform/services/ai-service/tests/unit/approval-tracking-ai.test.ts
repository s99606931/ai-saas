// MTU-N382 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  createFlow,
  advanceStep,
  detectDelayedSteps,
  escalateOverdue,
  estimateCompletion,
  getApprovalAuditLog,
  ApprovalTrackingAiService,
} from '../../src/lib/approval-tracking-ai';

function mkFlow() {
  return createFlow('flow-1', 'doc-1', [
    { stepId: 's1', approverId: 'u1', order: 1, slaMinutes: 60 },
    { stepId: 's2', approverId: 'u2', order: 2, slaMinutes: 30 },
  ]);
}

describe('MTU-N382 ApprovalTrackingAi', () => {
  it('플로우 생성', () => {
    const f = mkFlow();
    expect(f.steps.length).toBe(2);
    expect(f.steps[0]?.status).toBe('pending');
  });

  it('단계 승인', () => {
    const f = mkFlow();
    advanceStep('t1', f, 's1', true);
    expect(f.steps[0]?.status).toBe('approved');
    expect(f.steps[1]?.status).toBe('in_review');
  });

  it('단계 반려', () => {
    const f = mkFlow();
    advanceStep('t1', f, 's1', false);
    expect(f.steps[0]?.status).toBe('rejected');
    expect(f.steps[1]?.status).toBe('pending');
  });

  it('존재하지 않는 단계 예외', () => {
    const f = mkFlow();
    expect(() => advanceStep('t1', f, 'missing', true)).toThrow();
  });

  it('지연 단계 탐지', () => {
    const f = mkFlow();
    advanceStep('t1', f, 's1', true);
    if (f.steps[1]) f.steps[1].startedAt = Date.now() - 60 * 60_000;
    const delayed = detectDelayedSteps(f);
    expect(delayed.length).toBe(1);
  });

  it('지연 없으면 빈 배열', () => {
    const f = mkFlow();
    const delayed = detectDelayedSteps(f);
    expect(delayed.length).toBe(0);
  });

  it('에스컬레이션', () => {
    const f = mkFlow();
    advanceStep('t1', f, 's1', true);
    if (f.steps[1]) f.steps[1].startedAt = Date.now() - 60 * 60_000;
    const esc = escalateOverdue('t1', f, [{ overdueMinutes: 30, escalateTo: 'manager' }]);
    expect(esc.length).toBe(1);
  });

  it('예상 완료 시각', () => {
    const f = mkFlow();
    const eta = estimateCompletion(f);
    expect(eta).toBeGreaterThan(Date.now());
  });

  it('서비스 클래스', () => {
    const svc = new ApprovalTrackingAiService('t2');
    const f = svc.create('flow-2', 'doc-2', [{ stepId: 's', approverId: 'u', order: 1, slaMinutes: 10 }]);
    expect(f.flowId).toBe('flow-2');
  });

  it('감사 로그 기록', () => {
    const f = mkFlow();
    advanceStep('tenant-audit', f, 's1', true);
    expect(getApprovalAuditLog('tenant-audit').length).toBeGreaterThan(0);
  });
});
