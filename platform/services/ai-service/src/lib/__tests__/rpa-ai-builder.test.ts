import { describe, it, expect, beforeEach } from 'vitest';
import { RpaAiBuilder, type BotProcess } from '../rpa-ai-builder';

describe('RpaAiBuilder', () => {
  let svc: RpaAiBuilder;

  const process: BotProcess = {
    id: 'p1',
    name: '민원 자동화',
    actions: [
      { id: 'a1', type: 'api-call', target: '/login' },
      { id: 'a2', type: 'read', target: 'form' },
      { id: 'a3', type: 'type', target: 'response', onError: 'retry' },
    ],
    edges: [
      { from: 'a1', to: 'a2' },
      { from: 'a2', to: 'a3' },
    ],
  };

  beforeEach(() => {
    svc = new RpaAiBuilder();
    svc.registerProcess(process);
  });

  it('FR-RPA.1 프로세스 등록', () => {
    expect(() => svc.execute('p1', () => true)).not.toThrow();
  });

  it('FR-RPA.2 액션 카탈로그', () => {
    expect(svc.getActionCatalog()).toContain('click');
    expect(svc.getActionCatalog()).toContain('api-call');
  });

  it('FR-RPA.3 실행 (성공)', () => {
    const r = svc.execute('p1', () => true);
    expect(r.status).toBe('success');
    expect(r.executedActions).toBe(3);
  });

  it('FR-RPA.4 예외 처리 (retry)', () => {
    let attempts = 0;
    const r = svc.execute('p1', (action) => {
      if (action.id === 'a3' && attempts === 0) {
        attempts++;
        return false;
      }
      return true;
    });
    expect(r.executedActions).toBeGreaterThanOrEqual(2);
  });

  it('FR-RPA.5 실행 로그', () => {
    svc.execute('p1', () => true);
    expect(svc.getExecutionLog('p1').length).toBe(3);
  });
});
