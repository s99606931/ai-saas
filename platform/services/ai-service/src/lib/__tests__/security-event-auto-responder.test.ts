import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityEventAutoResponder } from '../security-event-auto-responder';

describe('SecurityEventAutoResponder', () => {
  let responder: SecurityEventAutoResponder;

  beforeEach(() => {
    responder = new SecurityEventAutoResponder();
  });

  it('규칙을 등록한다', () => {
    responder.registerRule('r1', 'BRUTE_FORCE', 5, 'block', 60000);
    expect(responder.getAuditLog().some(l => l.action === 'REGISTER_RULE')).toBe(true);
  });

  it('이벤트를 기록하고 ID를 반환한다', () => {
    const event = responder.recordEvent('BRUTE_FORCE', 'high', '10.0.0.1');
    expect(event.id).toBeDefined();
    expect(event.type).toBe('BRUTE_FORCE');
  });

  it('임계값 초과 시 자동 대응을 트리거한다', () => {
    responder.registerRule('r1', 'BRUTE_FORCE', 3, 'block', 0, 300000);
    const events = [];
    for (let i = 0; i < 3; i++) {
      events.push(responder.recordEvent('BRUTE_FORCE', 'high', '10.0.0.1'));
    }
    const decision = responder.processEvent(events[2]!.id);
    expect(decision.triggered).toBe(true);
    expect(decision.action).toBe('block');
  });

  it('임계값 미달 시 대응하지 않는다', () => {
    responder.registerRule('r1', 'BRUTE_FORCE', 10, 'block', 0);
    const event = responder.recordEvent('BRUTE_FORCE', 'high', '10.0.0.1');
    const decision = responder.processEvent(event.id);
    expect(decision.triggered).toBe(false);
  });

  it('쿨다운 내 중복 대응을 방지한다', () => {
    responder.registerRule('r1', 'BRUTE_FORCE', 1, 'block', 999999, 300000);
    const e1 = responder.recordEvent('BRUTE_FORCE', 'high', '10.0.0.1');
    const e2 = responder.recordEvent('BRUTE_FORCE', 'high', '10.0.0.1');
    responder.processEvent(e1.id);
    const decision2 = responder.processEvent(e2.id);
    expect(decision2.triggered).toBe(false);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    expect(() => responder.recordEvent('TEST', 'low', '10.0.0.1', 'C' as never)).toThrow('BLOCKED');
  });

  it('대응 이력을 조회한다', () => {
    responder.registerRule('r1', 'SQL_INJECT', 1, 'alert', 0, 300000);
    const event = responder.recordEvent('SQL_INJECT', 'critical', '10.0.0.2');
    responder.processEvent(event.id);
    const history = responder.getResponseHistory('SQL_INJECT');
    expect(history.length).toBe(1);
    expect(history[0]!.action).toBe('alert');
  });

  it('매칭 규칙 없으면 triggered=false이다', () => {
    const event = responder.recordEvent('UNKNOWN_TYPE', 'low', '10.0.0.1');
    const decision = responder.processEvent(event.id);
    expect(decision.triggered).toBe(false);
  });
});
