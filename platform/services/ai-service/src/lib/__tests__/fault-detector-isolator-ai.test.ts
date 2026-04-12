import { describe, it, expect, beforeEach } from 'vitest';
import { FaultDetectorIsolatorAI } from '../fault-detector-isolator-ai';

describe('FaultDetectorIsolatorAI', () => {
  let detector: FaultDetectorIsolatorAI;

  beforeEach(() => {
    detector = new FaultDetectorIsolatorAI();
  });

  it('서비스를 등록한다', () => {
    detector.registerService('svc-a', 'Service A', 3, 1000);
    const status = detector.getServiceStatus('svc-a');
    expect(status.state).toBe('healthy');
    expect(status.consecutiveFailures).toBe(0);
  });

  it('연속 실패로 격리 상태로 전환된다', () => {
    detector.registerService('svc-a', 'Service A', 3, 1000);
    detector.recordHealthEvent('svc-a', false);
    detector.recordHealthEvent('svc-a', false);
    detector.recordHealthEvent('svc-a', false);
    const status = detector.getServiceStatus('svc-a');
    expect(status.state).toBe('isolated');
  });

  it('임계값 미달이면 격리되지 않는다', () => {
    detector.registerService('svc-a', 'Service A', 3, 1000);
    detector.recordHealthEvent('svc-a', false);
    detector.recordHealthEvent('svc-a', false);
    expect(detector.getServiceStatus('svc-a').state).toBe('healthy');
  });

  it('성공 이벤트로 연속 실패 카운터가 초기화된다', () => {
    detector.registerService('svc-a', 'Service A', 3, 1000);
    detector.recordHealthEvent('svc-a', false);
    detector.recordHealthEvent('svc-a', false);
    detector.recordHealthEvent('svc-a', true);
    expect(detector.getServiceStatus('svc-a').consecutiveFailures).toBe(0);
  });

  it('격리 상태가 아니면 복구 불가를 반환한다', () => {
    detector.registerService('svc-a', 'Service A', 3, 1000);
    const result = detector.checkRecovery('svc-a');
    expect(result.canRecover).toBe(false);
  });

  it('쿨다운 미경과 시 복구 불가를 반환한다', () => {
    detector.registerService('svc-a', 'Service A', 3, 999999);
    for (let i = 0; i < 3; i++) detector.recordHealthEvent('svc-a', false);
    const result = detector.checkRecovery('svc-a');
    expect(result.canRecover).toBe(false);
    expect(result.newState).toBe('isolated');
  });

  it('C등급 데이터 전송을 차단한다', () => {
    detector.registerService('svc-a', 'Service A');
    expect(() => detector.recordHealthEvent('svc-a', true, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 서비스 상태 조회 시 오류를 던진다', () => {
    expect(() => detector.getServiceStatus('unknown')).toThrow('서비스 미등록');
  });

  it('격리 후 성공 이벤트로 recovering 상태가 healthy로 전환된다', () => {
    detector.registerService('svc-a', 'A', 2, 0);
    detector.recordHealthEvent('svc-a', false);
    detector.recordHealthEvent('svc-a', false);
    detector.checkRecovery('svc-a');
    detector.recordHealthEvent('svc-a', true);
    expect(detector.getServiceStatus('svc-a').state).toBe('healthy');
  });
});
