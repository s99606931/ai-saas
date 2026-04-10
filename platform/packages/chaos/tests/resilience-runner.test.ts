// 복원력 테스트 실행기 테스트
// Design Ref: SVC-CHAOS-R12 Plan
// Plan SC: FR-CHAOS.3

import { describe, it, expect } from 'vitest';
import { ResilienceTestRunner, ResilienceScenarios } from '../src/resilience-runner.js';

describe('ResilienceTestRunner -- 시나리오 실행', () => {
  it('DB 연결 실패 시나리오를 통과한다', async () => {
    const runner = new ResilienceTestRunner();

    const result = await runner.runScenario(
      ResilienceScenarios.dbConnectionFailure(async () => {
        throw new Error('DB 연결 실패 시뮬레이션');
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.scenario).toBe('db-connection-failure');
    expect(result.metrics?.circuitBreakerTriggered).toBe(true);
    expect(result.metrics?.failedRequests).toBeGreaterThan(0);
  });

  it('서비스 타임아웃 시나리오를 통과한다', async () => {
    const runner = new ResilienceTestRunner();

    const result = await runner.runScenario(
      ResilienceScenarios.serviceTimeout(50),
    );

    expect(result.passed).toBe(true);
    expect(result.scenario).toBe('service-timeout');
    expect(result.metrics?.circuitBreakerTriggered).toBe(true);
  }, 10000); // 타임아웃 연장

  it('에러 급증 후 복구 시나리오를 통과한다', async () => {
    const runner = new ResilienceTestRunner();

    const result = await runner.runScenario(
      ResilienceScenarios.errorSpikeAndRecovery(),
    );

    expect(result.passed).toBe(true);
    expect(result.scenario).toBe('error-spike-recovery');
    expect(result.metrics?.circuitBreakerTriggered).toBe(true);
    expect(result.metrics?.recoveryTimeMs).toBeGreaterThan(0);
  });
});

describe('ResilienceTestRunner -- 결과 관리', () => {
  it('모든 시나리오 통과 시 allPassed가 true를 반환한다', async () => {
    const runner = new ResilienceTestRunner();

    await runner.runScenario(
      ResilienceScenarios.dbConnectionFailure(async () => {
        throw new Error('fail');
      }),
    );

    await runner.runScenario(
      ResilienceScenarios.errorSpikeAndRecovery(),
    );

    expect(runner.allPassed()).toBe(true);
    expect(runner.getResults()).toHaveLength(2);
  });

  it('결과를 초기화할 수 있다', async () => {
    const runner = new ResilienceTestRunner();

    await runner.runScenario(
      ResilienceScenarios.dbConnectionFailure(async () => {
        throw new Error('fail');
      }),
    );

    expect(runner.getResults()).toHaveLength(1);
    runner.clearResults();
    expect(runner.getResults()).toHaveLength(0);
  });
});
