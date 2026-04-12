// MTU-N316 커스텀 워크플로우 엔진 테스트
import { describe, it, expect } from 'vitest';
import { CustomWorkflowService } from '../custom-workflow-engine.js';

describe('MTU-N316 CustomWorkflow', () => {
  const svc = new CustomWorkflowService('tenant-n316');

  it('FR-N316.1: 워크플로우 정의', () => {
    const wf = svc.define('승인 프로세스', '문서 승인', [
      { stepId: 's1', name: '검토', type: 'review', assignee: 'reviewer', nextSteps: ['s2'] },
      { stepId: 's2', name: '승인', type: 'approval', assignee: 'approver', nextSteps: [] },
    ]);
    expect(wf).toBeDefined();
  });

  it('FR-N316.2: 인스턴스 시작', () => {
    const wf = svc.define('간단 절차', 'test', [
      { stepId: 's1', name: '확인', type: 'review', assignee: 'u1', nextSteps: [] },
    ]);
    const inst = svc.start(wf.workflowId);
    expect(inst).toBeDefined();
  });

  it('FR-N316.3: 단계 완료', () => {
    const wf = svc.define('플로우', 'desc', [
      { stepId: 's1', name: '시작', type: 'action', assignee: 'u1', nextSteps: [] },
    ]);
    const inst = svc.start(wf.workflowId);
    const updated = svc.complete(inst.instanceId, 's1');
    expect(updated).toBeDefined();
  });

  it('FR-N316.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
