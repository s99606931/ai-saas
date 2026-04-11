// 헬스체크 집계기 테스트
// Design Ref: SVC-HEALTHAGG-R23 Plan
// Plan SC: FR-HA.1, FR-HA.2, FR-HA.3, FR-HA.4, FR-HA.5
// CSAP: D-14 운영 관리

import { describe, it, expect } from 'vitest';
import { HealthAggregator } from '../src/health-aggregator.js';

describe('HealthAggregator', () => {
  describe('FR-HA.1: 서비스 등록', () => {
    it('서비스를 등록할 수 있다', () => {
      const agg = new HealthAggregator();
      agg.register({
        name: 'auth-service',
        checker: async () => ({ status: 'healthy', responseTimeMs: 10 }),
      });
      expect(agg.getRegisteredServices()).toEqual(['auth-service']);
    });

    it('여러 서비스를 등록할 수 있다', () => {
      const agg = new HealthAggregator();
      agg.register({ name: 'svc-1', checker: async () => ({ status: 'healthy', responseTimeMs: 10 }) });
      agg.register({ name: 'svc-2', checker: async () => ({ status: 'healthy', responseTimeMs: 10 }) });
      agg.register({ name: 'svc-3', checker: async () => ({ status: 'healthy', responseTimeMs: 10 }) });
      expect(agg.getRegisteredServices()).toHaveLength(3);
    });

    it('서비스를 등록 해제할 수 있다', () => {
      const agg = new HealthAggregator();
      agg.register({ name: 'temp', checker: async () => ({ status: 'healthy', responseTimeMs: 10 }) });
      expect(agg.unregister('temp')).toBe(true);
      expect(agg.getRegisteredServices()).toHaveLength(0);
    });
  });

  describe('FR-HA.2: 개별 서비스 상태 확인', () => {
    it('healthy 서비스를 확인한다', async () => {
      const agg = new HealthAggregator();
      agg.register({
        name: 'healthy-svc',
        checker: async () => ({ status: 'healthy', responseTimeMs: 5 }),
      });

      const status = await agg.checkService('healthy-svc');
      expect(status!.status).toBe('healthy');
      expect(status!.consecutiveFailures).toBe(0);
    });

    it('unhealthy 서비스를 확인한다', async () => {
      const agg = new HealthAggregator();
      agg.register({
        name: 'sick-svc',
        checker: async () => { throw new Error('연결 실패'); },
      });

      const status = await agg.checkService('sick-svc');
      expect(status!.status).toBe('unhealthy');
      expect(status!.error).toBe('연결 실패');
      expect(status!.consecutiveFailures).toBe(1);
    });

    it('연속 실패 횟수를 추적한다', async () => {
      const agg = new HealthAggregator();
      agg.register({
        name: 'flaky',
        checker: async () => { throw new Error('실패'); },
      });

      await agg.checkService('flaky');
      await agg.checkService('flaky');
      await agg.checkService('flaky');

      const status = await agg.checkService('flaky');
      expect(status!.consecutiveFailures).toBe(4);
    });

    it('복구 시 연속 실패 횟수가 리셋된다', async () => {
      let shouldFail = true;
      const agg = new HealthAggregator();
      agg.register({
        name: 'recovering',
        checker: async () => {
          if (shouldFail) throw new Error('down');
          return { status: 'healthy' as const, responseTimeMs: 10 };
        },
      });

      await agg.checkService('recovering');
      await agg.checkService('recovering');
      shouldFail = false;

      const status = await agg.checkService('recovering');
      expect(status!.status).toBe('healthy');
      expect(status!.consecutiveFailures).toBe(0);
    });

    it('미등록 서비스는 undefined', async () => {
      const agg = new HealthAggregator();
      const status = await agg.checkService('nonexistent');
      expect(status).toBeUndefined();
    });

    it('타임아웃 초과 시 unhealthy', async () => {
      const agg = new HealthAggregator({ defaultTimeoutMs: 50 });
      agg.register({
        name: 'slow',
        checker: async () => {
          await new Promise((r) => setTimeout(r, 200));
          return { status: 'healthy' as const, responseTimeMs: 200 };
        },
      });

      const status = await agg.checkService('slow');
      expect(status!.status).toBe('unhealthy');
      expect(status!.error).toContain('타임아웃');
    });
  });

  describe('FR-HA.3: 전체 서비스 집계 상태', () => {
    it('모든 서비스 healthy → 종합 healthy', async () => {
      const agg = new HealthAggregator();
      agg.register({ name: 'a', checker: async () => ({ status: 'healthy', responseTimeMs: 10 }) });
      agg.register({ name: 'b', checker: async () => ({ status: 'healthy', responseTimeMs: 10 }) });

      const result = await agg.checkAll();
      expect(result.status).toBe('healthy');
      expect(result.healthyCount).toBe(2);
      expect(result.totalCount).toBe(2);
    });

    it('critical 서비스 unhealthy → 종합 unhealthy', async () => {
      const agg = new HealthAggregator();
      agg.register({
        name: 'critical-db',
        critical: true,
        checker: async () => { throw new Error('DB 다운'); },
      });
      agg.register({
        name: 'optional',
        checker: async () => ({ status: 'healthy', responseTimeMs: 10 }),
      });

      const result = await agg.checkAll();
      expect(result.status).toBe('unhealthy');
      expect(result.unhealthyCount).toBe(1);
    });

    it('non-critical 서비스 unhealthy → 종합 degraded', async () => {
      const agg = new HealthAggregator();
      agg.register({
        name: 'cache',
        critical: false,
        checker: async () => { throw new Error('캐시 실패'); },
      });
      agg.register({
        name: 'main',
        checker: async () => ({ status: 'healthy', responseTimeMs: 10 }),
      });

      const result = await agg.checkAll();
      expect(result.status).toBe('degraded');
      expect(result.unhealthyCount).toBe(1);
      expect(result.healthyCount).toBe(1);
    });

    it('checkDurationMs를 측정한다', async () => {
      const agg = new HealthAggregator();
      agg.register({
        name: 'svc',
        checker: async () => ({ status: 'healthy', responseTimeMs: 10 }),
      });

      const result = await agg.checkAll();
      expect(result.checkDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.checkedAt).toBeDefined();
    });

    it('서비스 없으면 healthy', async () => {
      const agg = new HealthAggregator();
      const result = await agg.checkAll();
      expect(result.status).toBe('healthy');
      expect(result.totalCount).toBe(0);
    });
  });

  describe('FR-HA.4: 종속성 체크', () => {
    it('DB 종속성 체크를 시뮬레이션한다', async () => {
      const agg = new HealthAggregator();
      agg.register({
        name: 'postgres',
        critical: true,
        tags: ['database'],
        checker: async () => ({
          status: 'healthy',
          responseTimeMs: 2,
          details: { connections: 10, maxConnections: 100 },
        }),
      });

      const status = await agg.checkService('postgres');
      expect(status!.status).toBe('healthy');
      expect(status!.tags).toContain('database');
    });
  });

  describe('FR-HA.5: 상태 이력 추적', () => {
    it('최근 체크 이력을 보존한다', async () => {
      const agg = new HealthAggregator({ maxHistorySize: 5 });
      agg.register({
        name: 'svc',
        checker: async () => ({ status: 'healthy', responseTimeMs: 10 }),
      });

      for (let i = 0; i < 3; i++) {
        await agg.checkService('svc');
      }

      const status = agg.getServiceStatus('svc');
      expect(status!.history).toHaveLength(3);
    });

    it('최대 이력 수를 초과하면 오래된 항목을 제거한다', async () => {
      const agg = new HealthAggregator({ maxHistorySize: 3 });
      agg.register({
        name: 'svc',
        checker: async () => ({ status: 'healthy', responseTimeMs: 10 }),
      });

      for (let i = 0; i < 5; i++) {
        await agg.checkService('svc');
      }

      const status = agg.getServiceStatus('svc');
      expect(status!.history).toHaveLength(3);
    });
  });

  describe('느린 응답 degraded 처리', () => {
    it('응답 느린 서비스를 degraded로 판정한다', async () => {
      const agg = new HealthAggregator({ degradedThresholdMs: 50 });
      agg.register({
        name: 'slow-but-ok',
        checker: async () => {
          await new Promise((r) => setTimeout(r, 100));
          return { status: 'healthy' as const, responseTimeMs: 100 };
        },
        timeoutMs: 5000,
      });

      const status = await agg.checkService('slow-but-ok');
      expect(status!.status).toBe('degraded');
    });
  });
});
