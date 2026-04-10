// AlertManager 단위 테스트
// Design Ref: SVC-OBSERVE-R15 Plan
// Plan SC: FR-OBS.4

import { describe, it, expect, beforeEach } from 'vitest';
import { AlertManager, type AlertRule } from '../src/alert-manager.js';

describe('AlertManager', () => {
  let manager: AlertManager;

  const errorRateRule: AlertRule = {
    name: 'high_error_rate',
    description: '에러율 5% 초과',
    metricName: 'error_rate',
    threshold: 5,
    operator: 'gt',
    severity: 'critical',
  };

  const latencyRule: AlertRule = {
    name: 'high_latency',
    description: '응답 시간 2초 초과',
    metricName: 'response_time_p99',
    threshold: 2,
    operator: 'gt',
    consecutiveCount: 3,
    severity: 'warning',
  };

  beforeEach(() => {
    manager = new AlertManager();
  });

  it('알림 규칙을 등록한다', () => {
    manager.addRule(errorRateRule);

    expect(manager.getRuleCount()).toBe(1);
    const status = manager.getStatus('high_error_rate');
    expect(status).not.toBeNull();
    expect(status!.state).toBe('inactive');
  });

  it('임계값 초과 시 firing 상태가 된다', () => {
    manager.addRule(errorRateRule);

    const events = manager.evaluate('error_rate', 10);

    expect(events).toHaveLength(1);
    expect(events[0]!.newState).toBe('firing');
    expect(manager.getStatus('high_error_rate')!.state).toBe('firing');
  });

  it('임계값 미만이면 inactive 상태를 유지한다', () => {
    manager.addRule(errorRateRule);

    const events = manager.evaluate('error_rate', 3);

    expect(events).toHaveLength(0);
    expect(manager.getStatus('high_error_rate')!.state).toBe('inactive');
  });

  it('firing 후 임계값 미만이면 resolved가 된다', () => {
    manager.addRule(errorRateRule);

    manager.evaluate('error_rate', 10); // firing
    const events = manager.evaluate('error_rate', 2); // resolved

    expect(events).toHaveLength(1);
    expect(events[0]!.newState).toBe('resolved');
    expect(manager.getStatus('high_error_rate')!.state).toBe('resolved');
  });

  it('consecutiveCount로 flapping을 방지한다', () => {
    manager.addRule(latencyRule); // consecutiveCount: 3

    // 1회 초과 -- pending
    let events = manager.evaluate('response_time_p99', 3);
    expect(events).toHaveLength(0);
    expect(manager.getStatus('high_latency')!.state).toBe('pending');

    // 2회 초과 -- 아직 pending
    events = manager.evaluate('response_time_p99', 4);
    expect(events).toHaveLength(0);

    // 3회 초과 -- firing
    events = manager.evaluate('response_time_p99', 5);
    expect(events).toHaveLength(1);
    expect(events[0]!.newState).toBe('firing');
  });

  it('연속 위반 중 정상값이 오면 카운트를 초기화한다', () => {
    manager.addRule(latencyRule); // consecutiveCount: 3

    manager.evaluate('response_time_p99', 3); // 1회 초과
    manager.evaluate('response_time_p99', 4); // 2회 초과
    manager.evaluate('response_time_p99', 1); // 정상 -- 카운트 리셋

    const status = manager.getStatus('high_latency');
    expect(status!.currentCount).toBe(0);
    expect(status!.state).toBe('inactive');
  });

  it('firing 상태에서 중복 firing 이벤트를 발생하지 않는다', () => {
    manager.addRule(errorRateRule);

    const events1 = manager.evaluate('error_rate', 10); // firing
    const events2 = manager.evaluate('error_rate', 15); // 여전히 초과

    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(0); // 중복 방지
    expect(manager.getStatus('high_error_rate')!.state).toBe('firing');
  });

  it('getFiringAlerts()가 firing 상태 알림을 반환한다', () => {
    manager.addRule(errorRateRule);
    manager.addRule(latencyRule);

    manager.evaluate('error_rate', 10); // high_error_rate firing

    const firing = manager.getFiringAlerts();
    expect(firing).toHaveLength(1);
    expect(firing[0]!.rule.name).toBe('high_error_rate');
  });

  it('getAllStatuses()가 모든 규칙 상태를 반환한다', () => {
    manager.addRule(errorRateRule);
    manager.addRule(latencyRule);

    const statuses = manager.getAllStatuses();
    expect(statuses).toHaveLength(2);
  });

  it('getEvents()가 알림 이벤트 이력을 반환한다', () => {
    manager.addRule(errorRateRule);

    manager.evaluate('error_rate', 10); // firing
    manager.evaluate('error_rate', 1); // resolved

    const events = manager.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0]!.newState).toBe('firing');
    expect(events[1]!.newState).toBe('resolved');
  });

  it('removeRule()이 규칙을 제거한다', () => {
    manager.addRule(errorRateRule);
    expect(manager.getRuleCount()).toBe(1);

    const removed = manager.removeRule('high_error_rate');
    expect(removed).toBe(true);
    expect(manager.getRuleCount()).toBe(0);
  });

  it('관련 없는 메트릭은 무시한다', () => {
    manager.addRule(errorRateRule);

    const events = manager.evaluate('unrelated_metric', 999);

    expect(events).toHaveLength(0);
  });

  it('다양한 비교 연산자를 지원한다', () => {
    // lt 연산자
    manager.addRule({
      name: 'low_disk',
      description: '디스크 부족',
      metricName: 'disk_free_gb',
      threshold: 10,
      operator: 'lt',
      severity: 'critical',
    });

    const events = manager.evaluate('disk_free_gb', 5);
    expect(events).toHaveLength(1);
    expect(events[0]!.newState).toBe('firing');
  });

  it('lastValue를 업데이트한다', () => {
    manager.addRule(errorRateRule);

    manager.evaluate('error_rate', 3);
    expect(manager.getStatus('high_error_rate')!.lastValue).toBe(3);

    manager.evaluate('error_rate', 7);
    expect(manager.getStatus('high_error_rate')!.lastValue).toBe(7);
  });
});
