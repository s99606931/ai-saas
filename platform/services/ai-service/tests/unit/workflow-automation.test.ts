import { describe, it, expect } from 'vitest';
import { createWorkflow, activateWorkflow, evaluateTrigger, executeWorkflow, getWorkflow, listWorkflows, getWorkflowAuditLog } from '../../src/lib/workflow-automation';

describe('워크플로우 자동화', () => {
  it('워크플로우를 생성해야 한다', () => {
    const wf = createWorkflow({
      name: '결재 자동화',
      description: '기안 등록 시 자동 결재선 배정',
      nodes: [
        { type: 'trigger', name: '기안 등록', config: {}, nextNodes: [] },
        { type: 'condition', name: '금액 확인', config: { field: 'amount', operator: 'gt', value: 100000 }, nextNodes: [] },
        { type: 'action', name: '알림 발송', config: { actionType: 'notification' }, nextNodes: [] },
        { type: 'end', name: '완료', config: {}, nextNodes: [] },
      ],
      triggerType: 'event',
      triggerConfig: { eventType: 'draft_created' },
      actor: 'admin',
    });
    expect(wf.id).toBeDefined();
    expect(wf.status).toBe('draft');
  });

  it('워크플로우를 활성화해야 한다', () => {
    const wf = createWorkflow({
      name: '테스트 WF', description: '', nodes: [],
      triggerType: 'manual', triggerConfig: {}, actor: 'admin',
    });
    activateWorkflow(wf.id, 'admin');
    expect(getWorkflow(wf.id)?.status).toBe('active');
  });

  it('트리거를 평가해야 한다', () => {
    const wf = createWorkflow({
      name: '이벤트 WF', description: '', nodes: [],
      triggerType: 'event', triggerConfig: { eventType: 'user_login' }, actor: 'admin',
    });
    activateWorkflow(wf.id, 'admin');
    expect(evaluateTrigger(wf.id, { type: 'user_login' })).toBe(true);
    expect(evaluateTrigger(wf.id, { type: 'user_logout' })).toBe(false);
  });

  it('워크플로우를 실행해야 한다', () => {
    const wf = createWorkflow({
      name: '실행 테스트', description: '',
      nodes: [
        { type: 'trigger', name: '시작', config: {}, nextNodes: [] },
        { type: 'condition', name: '조건', config: { field: 'amount', operator: 'gt', value: 50000 }, nextNodes: [] },
        { type: 'action', name: '액션', config: { actionType: 'email' }, nextNodes: [] },
        { type: 'end', name: '종료', config: {}, nextNodes: [] },
      ],
      triggerType: 'manual', triggerConfig: {}, actor: 'admin',
    });

    const execution = executeWorkflow(wf.id, { amount: 100000 }, 'system');
    expect(execution.status).toBe('completed');
    expect(execution.nodeResults.length).toBe(4);
  });

  it('조건 노드가 올바르게 평가되어야 한다', () => {
    const wf = createWorkflow({
      name: '조건 테스트', description: '',
      nodes: [
        { type: 'condition', name: '금액 조건', config: { field: 'amount', operator: 'lt', value: 10000 }, nextNodes: [] },
      ],
      triggerType: 'manual', triggerConfig: {}, actor: 'admin',
    });

    const execution = executeWorkflow(wf.id, { amount: 5000 }, 'system');
    const condResult = execution.nodeResults.find((n) => n.nodeName === '금액 조건');
    expect(condResult?.output.conditionMet).toBe(true);
  });

  it('워크플로우 목록을 조회해야 한다', () => {
    expect(listWorkflows().length).toBeGreaterThan(0);
  });

  it('감사 로그가 기록되어야 한다', () => {
    expect(getWorkflowAuditLog().length).toBeGreaterThan(0);
  });
});
