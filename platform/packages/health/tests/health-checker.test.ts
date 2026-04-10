// @public-saas/health 헬스체크 엔진 테스트
// Design Ref: SVC-HEALTH-R10 Plan
// Plan SC: FR-HEALTH.1, FR-HEALTH.3, FR-HEALTH.4
// CSAP: D-07 가용성

import { describe, it, expect, beforeEach } from 'vitest';
import { HealthChecker, CommonCheckers } from '../src/health-checker.js';

describe('HealthChecker -- 기본 기능', () => {
  let checker: HealthChecker;

  beforeEach(() => {
    checker = new HealthChecker('test-service', '1.0.0');
  });

  it('의존성 없을 때 healthy', async () => {
    const status = await checker.check();
    expect(status.service).toBe('test-service');
    expect(status.status).toBe('healthy');
    expect(status.version).toBe('1.0.0');
    expect(status.uptime).toBeGreaterThanOrEqual(0);
    expect(status.dependencies).toHaveLength(0);
  });

  it('liveness -- 항상 ok', () => {
    const result = checker.liveness();
    expect(result.status).toBe('ok');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('readiness -- 의존성 없으면 ready', async () => {
    const result = await checker.readiness();
    expect(result.ready).toBe(true);
  });
});

describe('HealthChecker -- 의존성 체크', () => {
  it('모든 의존성 healthy -> 전체 healthy', async () => {
    const checker = new HealthChecker('svc');
    checker.addChecker({
      name: 'db',
      check: async () => ({ healthy: true }),
    });
    checker.addChecker({
      name: 'redis',
      check: async () => ({ healthy: true }),
    });

    const status = await checker.check();
    expect(status.status).toBe('healthy');
    expect(status.dependencies).toHaveLength(2);
    expect(status.dependencies[0].status).toBe('healthy');
  });

  it('하나라도 unhealthy -> 전체 unhealthy', async () => {
    const checker = new HealthChecker('svc');
    checker.addChecker({
      name: 'db',
      check: async () => ({ healthy: true }),
    });
    checker.addChecker({
      name: 'redis',
      check: async () => ({ healthy: false, message: 'Connection refused' }),
    });

    const status = await checker.check();
    expect(status.status).toBe('unhealthy');
    expect(status.dependencies[1].status).toBe('unhealthy');
    expect(status.dependencies[1].message).toBe('Connection refused');
  });

  it('readiness -- unhealthy 의존성 있으면 not ready', async () => {
    const checker = new HealthChecker('svc');
    checker.addChecker({
      name: 'db',
      check: async () => ({ healthy: false }),
    });

    const result = await checker.readiness();
    expect(result.ready).toBe(false);
  });

  it('체커 타임아웃 시 unhealthy', async () => {
    const checker = new HealthChecker('svc');
    checker.addChecker({
      name: 'slow-service',
      timeout: 100, // 100ms 타임아웃
      check: async () => {
        await new Promise((r) => setTimeout(r, 500));
        return { healthy: true };
      },
    });

    const status = await checker.check();
    expect(status.dependencies[0].status).toBe('unhealthy');
    expect(status.dependencies[0].message).toContain('Timeout');
  });

  it('체커에서 예외 발생 시 unhealthy', async () => {
    const checker = new HealthChecker('svc');
    checker.addChecker({
      name: 'error-service',
      check: async () => {
        throw new Error('Connection failed');
      },
    });

    const status = await checker.check();
    expect(status.dependencies[0].status).toBe('unhealthy');
    expect(status.dependencies[0].message).toBe('Connection failed');
  });
});

describe('HealthChecker -- SLA 메트릭', () => {
  it('이력 없을 때 100% 가용성', () => {
    const checker = new HealthChecker('svc');
    const sla = checker.calculateSLA();
    expect(sla.uptimePercentage).toBe(100);
    expect(sla.totalChecks).toBe(0);
  });

  it('체크 후 SLA 계산', async () => {
    const checker = new HealthChecker('svc');
    checker.addChecker({
      name: 'db',
      check: async () => ({ healthy: true }),
    });

    // 3번 체크
    await checker.check();
    await checker.check();
    await checker.check();

    const sla = checker.calculateSLA();
    expect(sla.totalChecks).toBe(3);
    expect(sla.healthyChecks).toBe(3);
    expect(sla.uptimePercentage).toBe(100);
  });

  it('unhealthy 체크가 있으면 가용성 감소', async () => {
    const checker = new HealthChecker('svc');
    let shouldFail = false;

    checker.addChecker({
      name: 'db',
      check: async () => ({ healthy: !shouldFail }),
    });

    // 3번 healthy
    await checker.check();
    await checker.check();
    await checker.check();

    // 1번 unhealthy
    shouldFail = true;
    await checker.check();

    const sla = checker.calculateSLA();
    expect(sla.totalChecks).toBe(4);
    expect(sla.healthyChecks).toBe(3);
    expect(sla.unhealthyChecks).toBe(1);
    expect(sla.uptimePercentage).toBe(75);
  });
});

describe('CommonCheckers -- 팩토리', () => {
  it('custom 체커 생성', async () => {
    const checker = CommonCheckers.custom('test', async () => true);
    expect(checker.name).toBe('test');
    const result = await checker.check();
    expect(result.healthy).toBe(true);
  });

  it('custom 체커 -- 실패 케이스', async () => {
    const checker = CommonCheckers.custom('test-fail', async () => false);
    const result = await checker.check();
    expect(result.healthy).toBe(false);
  });

  it('database 체커 생성 (mock)', async () => {
    const mockPrisma = {
      $queryRaw: async () => [{ result: 1 }],
    };
    const checker = CommonCheckers.database(mockPrisma);
    expect(checker.name).toBe('database');
    const result = await checker.check();
    expect(result.healthy).toBe(true);
  });

  it('database 체커 -- 연결 실패', async () => {
    const mockPrisma = {
      $queryRaw: async () => {
        throw new Error('Connection refused');
      },
    };
    const checker = CommonCheckers.database(mockPrisma);
    const result = await checker.check();
    expect(result.healthy).toBe(false);
    expect(result.message).toContain('Connection refused');
  });
});
