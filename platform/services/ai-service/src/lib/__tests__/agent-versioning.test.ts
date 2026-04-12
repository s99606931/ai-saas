import { describe, it, expect, beforeEach } from 'vitest';
import { AgentVersionRegistry } from '../agent-versioning.js';

describe('AgentVersionRegistry', () => {
  let reg: AgentVersionRegistry;

  beforeEach(() => {
    reg = new AgentVersionRegistry(0.2);
  });

  it('첫 배포는 자동으로 active', () => {
    reg.publish('a1', '1.0.0', { tool: 'v1' });
    const v = reg.listVersions('a1');
    expect(v[0]?.rollout).toBe(100);
  });

  it('카나리 → 승격', () => {
    reg.publish('a1', '1.0.0', {});
    reg.publish('a1', '1.1.0', {});
    reg.startCanary('a1', '1.1.0', 10);
    const plan = reg.promote('a1');
    expect(plan.active).toBe('1.1.0');
    expect(plan.canary).toBeUndefined();
  });

  it('롤백 동작', () => {
    reg.publish('a1', '1.0.0', {});
    reg.publish('a1', '2.0.0', {});
    reg.startCanary('a1', '2.0.0', 20);
    reg.promote('a1');
    const plan = reg.rollback('a1', '1.0.0');
    expect(plan.active).toBe('1.0.0');
  });

  it('자동 롤백 에러율 초과 시 트리거', () => {
    reg.publish('a1', '1.0.0', {});
    reg.publish('a1', '1.1.0', {});
    reg.startCanary('a1', '1.1.0', 10);
    for (let i = 0; i < 10; i++) {
      reg.recordInvocation('a1', '1.1.0', i < 3);
    }
    const r = reg.checkAutoRollback('a1');
    expect(r.triggered).toBe(true);
    expect(r.to).toBe('1.0.0');
  });

  it('디프 계산', () => {
    reg.publish('a1', '1.0.0', { model: 'gpt-3' });
    reg.publish('a1', '1.1.0', { model: 'gpt-4' });
    const diff = reg.diff('a1', '1.0.0', '1.1.0');
    expect(diff['model']).toEqual({ from: 'gpt-3', to: 'gpt-4' });
  });

  it('중복 버전 거부', () => {
    reg.publish('a1', '1.0.0', {});
    expect(() => reg.publish('a1', '1.0.0', {})).toThrow('VERSION_DUPLICATE');
  });
});
