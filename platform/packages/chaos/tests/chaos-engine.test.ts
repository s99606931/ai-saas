// Chaos Engine 단위 테스트
// Design Ref: SVC-CHAOS-R12 Plan
// Plan SC: FR-CHAOS.1, FR-CHAOS.4

import { describe, it, expect, beforeEach } from 'vitest';
import { ChaosEngine } from '../src/chaos-engine.js';

describe('ChaosEngine -- 장애 주입', () => {
  let engine: ChaosEngine;

  beforeEach(() => {
    engine = new ChaosEngine();
  });

  it('테스트 환경에서 자동 활성화된다', () => {
    expect(engine.isEnabled()).toBe(true);
  });

  it('장애를 주입하고 목록에서 확인할 수 있다', () => {
    const id = engine.injectFault({
      type: 'latency',
      probability: 0.5,
      delayMs: 100,
    });
    expect(id).toMatch(/^fault-/);
    expect(engine.listFaults()).toHaveLength(1);
    expect(engine.listFaults()[0].type).toBe('latency');
  });

  it('장애를 해제할 수 있다', () => {
    const id = engine.injectFault({
      type: 'error',
      probability: 1.0,
      errorCode: 500,
    });
    expect(engine.listFaults()).toHaveLength(1);
    engine.removeFault(id);
    expect(engine.listFaults()).toHaveLength(0);
  });

  it('전체 장애를 해제할 수 있다', () => {
    engine.injectFault({ type: 'latency', probability: 1.0, delayMs: 50 });
    engine.injectFault({ type: 'error', probability: 1.0, errorCode: 500 });
    expect(engine.listFaults()).toHaveLength(2);
    engine.clearAllFaults();
    expect(engine.listFaults()).toHaveLength(0);
  });
});

describe('ChaosEngine -- applyFault', () => {
  let engine: ChaosEngine;

  beforeEach(() => {
    engine = new ChaosEngine();
  });

  it('장애가 없으면 null을 반환한다', async () => {
    const result = await engine.applyFault('/test');
    expect(result).toBeNull();
  });

  it('확률 1.0인 에러 주입이 적용된다', async () => {
    engine.injectFault({
      type: 'error',
      probability: 1.0,
      errorCode: 503,
      errorMessage: '테스트 에러',
    });
    const result = await engine.applyFault('/test');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('error');
    expect(result!.errorCode).toBe(503);
    expect(result!.errorMessage).toBe('테스트 에러');
  });

  it('확률 0.0인 장애는 적용되지 않는다', async () => {
    engine.injectFault({
      type: 'error',
      probability: 0.0,
      errorCode: 500,
    });
    const result = await engine.applyFault('/test');
    expect(result).toBeNull();
  });

  it('targetPattern으로 대상을 필터링한다', async () => {
    engine.injectFault({
      type: 'error',
      probability: 1.0,
      targetPattern: '/api/tenants.*',
      errorCode: 500,
    });

    const match = await engine.applyFault('/api/tenants/123');
    expect(match).not.toBeNull();

    const noMatch = await engine.applyFault('/api/users/456');
    expect(noMatch).toBeNull();
  });

  it('connection_failure 유형이 503을 반환한다', async () => {
    engine.injectFault({
      type: 'connection_failure',
      probability: 1.0,
    });
    const result = await engine.applyFault('/test');
    expect(result!.type).toBe('connection_failure');
    expect(result!.errorCode).toBe(503);
  });

  it('latency 유형이 지연을 적용한다', async () => {
    engine.injectFault({
      type: 'latency',
      probability: 1.0,
      delayMs: 50,
    });
    const start = Date.now();
    const result = await engine.applyFault('/test');
    const elapsed = Date.now() - start;

    expect(result!.type).toBe('latency');
    expect(elapsed).toBeGreaterThanOrEqual(40); // 약간의 오차 허용
  });
});

describe('ChaosEngine -- 통계 및 이벤트', () => {
  let engine: ChaosEngine;

  beforeEach(() => {
    engine = new ChaosEngine();
  });

  it('이벤트가 기록된다', async () => {
    engine.injectFault({
      type: 'error',
      probability: 1.0,
      errorCode: 500,
    });
    await engine.applyFault('/test');
    const events = engine.getEvents();
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].applied).toBe(true);
  });

  it('통계가 올바르게 집계된다', async () => {
    engine.injectFault({
      type: 'error',
      probability: 1.0,
      errorCode: 500,
    });
    await engine.applyFault('/test1');
    await engine.applyFault('/test2');

    const stats = engine.getStats();
    expect(stats.totalFaults).toBe(1);
    expect(stats.totalEvents).toBe(2);
    expect(stats.appliedEvents).toBe(2);
  });
});

describe('ChaosEngine -- 안전 가드 (FR-CHAOS.4)', () => {
  it('비활성화 시 장애 주입이 무시된다', () => {
    const engine = new ChaosEngine();
    engine.disable();
    const id = engine.injectFault({
      type: 'error',
      probability: 1.0,
      errorCode: 500,
    });
    expect(id).toBe('');
    expect(engine.listFaults()).toHaveLength(0);
  });

  it('비활성화 시 applyFault가 null을 반환한다', async () => {
    const engine = new ChaosEngine();
    engine.disable();
    const result = await engine.applyFault('/test');
    expect(result).toBeNull();
  });
});
