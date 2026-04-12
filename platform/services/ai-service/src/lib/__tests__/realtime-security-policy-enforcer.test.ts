import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeSecurityPolicyEnforcer } from '../realtime-security-policy-enforcer';

describe('RealtimeSecurityPolicyEnforcer', () => {
  let enforcer: RealtimeSecurityPolicyEnforcer;

  beforeEach(() => {
    enforcer = new RealtimeSecurityPolicyEnforcer();
  });

  it('정책을 등록한다', () => {
    enforcer.registerPolicy('p1', '브루트포스 차단', { type: 'brute_force' }, 'block', 10);
    expect(enforcer.getAuditLog().some(l => l.action === 'REGISTER_POLICY')).toBe(true);
  });

  it('매칭 정책을 block으로 평가한다', () => {
    enforcer.registerPolicy('p1', '브루트포스 차단', { type: 'brute_force' }, 'block', 10);
    const result = enforcer.evaluate({ type: 'brute_force', ip: '10.0.0.1' });
    expect(result.matched).toBe(true);
    expect(result.action).toBe('block');
    expect(result.policyId).toBe('p1');
  });

  it('매칭 없으면 action=none이다', () => {
    enforcer.registerPolicy('p1', '차단', { type: 'brute_force' }, 'block', 10);
    const result = enforcer.evaluate({ type: 'normal_request' });
    expect(result.matched).toBe(false);
    expect(result.action).toBe('none');
  });

  it('우선순위가 높은 정책이 먼저 적용된다', () => {
    enforcer.registerPolicy('p1', '낮은 우선순위', { ip: '10.0.0.1' }, 'warn', 1);
    enforcer.registerPolicy('p2', '높은 우선순위', { ip: '10.0.0.1' }, 'block', 100);
    const result = enforcer.evaluate({ ip: '10.0.0.1' });
    expect(result.policyId).toBe('p2');
  });

  it('위반 이력을 기록한다', () => {
    enforcer.registerPolicy('p1', '차단정책', { risk: 'high' }, 'block', 10);
    enforcer.evaluate({ risk: 'high' });
    const history = enforcer.getViolationHistory('p1');
    expect(history.length).toBe(1);
    expect(history[0]!.action).toBe('block');
  });

  it('C등급 평가를 차단한다', () => {
    expect(() => enforcer.evaluate({ type: 'test' }, 'C' as never)).toThrow('BLOCKED');
  });

  it('warn 정책도 위반 이력에 기록된다', () => {
    enforcer.registerPolicy('p1', '경고정책', { level: 'warn' }, 'warn', 5);
    enforcer.evaluate({ level: 'warn' });
    expect(enforcer.getViolationHistory('p1').length).toBe(1);
  });
});
