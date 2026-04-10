// 테넌트별 Rate Limiter 테스트
// Design Ref: SVC-RATELIMIT-R19 Plan
// Plan SC: FR-RL.2, FR-RL.3, FR-RL.4
// CSAP: D-10 접근 제어

import { describe, it, expect, afterEach } from 'vitest';
import { TenantRateLimiter, type PlanLevel } from '../src/tenant-rate-limiter.js';

describe('TenantRateLimiter', () => {
  let limiter: TenantRateLimiter;

  afterEach(() => {
    if (limiter) limiter.destroy();
  });

  describe('FR-RL.2: 요금제별 한도', () => {
    it('free 요금제의 기본 한도는 100/min이다', () => {
      limiter = new TenantRateLimiter();
      const info = limiter.tryRequest('tenant-1', 'free');
      expect(info.limit).toBe(100);
      expect(info.plan).toBe('free');
    });

    it('standard 요금제의 기본 한도는 1000/min이다', () => {
      limiter = new TenantRateLimiter();
      const info = limiter.tryRequest('tenant-2', 'standard');
      expect(info.limit).toBe(1000);
    });

    it('enterprise 요금제의 기본 한도는 10000/min이다', () => {
      limiter = new TenantRateLimiter();
      const info = limiter.tryRequest('tenant-3', 'enterprise');
      expect(info.limit).toBe(10000);
    });

    it('커스텀 요금제 설정을 지원한다', () => {
      limiter = new TenantRateLimiter({
        plans: {
          custom: { requestsPerMinute: 500, burstMultiplier: 2.0 },
        },
      });
      const info = limiter.tryRequest('tenant-4', 'custom');
      expect(info.limit).toBe(500);
    });

    it('테넌트별 오버라이드가 요금제 설정을 우선한다', () => {
      limiter = new TenantRateLimiter({
        overrides: {
          'vip-tenant': { requestsPerMinute: 5000, burstMultiplier: 3.0 },
        },
      });
      const info = limiter.tryRequest('vip-tenant', 'free');
      expect(info.limit).toBe(5000); // free이지만 오버라이드 적용
    });
  });

  describe('FR-RL.3: 버스트 허용', () => {
    it('버스트 배율이 적용된다 (free: 100 x 1.5 = 150)', () => {
      limiter = new TenantRateLimiter();
      const info = limiter.tryRequest('tenant-1', 'free');
      expect(info.burstLimit).toBe(150);
    });

    it('enterprise 버스트 배율 (10000 x 2.0 = 20000)', () => {
      limiter = new TenantRateLimiter();
      const info = limiter.tryRequest('tenant-1', 'enterprise');
      expect(info.burstLimit).toBe(20000);
    });

    it('기본 한도 초과해도 버스트 한도 내에서 허용된다', () => {
      limiter = new TenantRateLimiter({
        plans: { free: { requestsPerMinute: 5, burstMultiplier: 2.0 } },
      });

      // 기본 한도 5, 버스트 한도 10
      for (let i = 0; i < 7; i++) {
        const info = limiter.tryRequest('tenant-1', 'free');
        expect(info.result.exceeded).toBe(false);
      }

      // 10 초과해야 차단
      for (let i = 0; i < 4; i++) {
        limiter.tryRequest('tenant-1', 'free');
      }
      // 11번째에서 차단
      const blocked = limiter.tryRequest('tenant-1', 'free');
      expect(blocked.result.exceeded).toBe(true);
    });
  });

  describe('FR-RL.4: 응답 헤더', () => {
    it('표준 Rate Limit 헤더를 반환한다', () => {
      limiter = new TenantRateLimiter();
      const info = limiter.tryRequest('tenant-1', 'free');

      expect(info.headers['X-RateLimit-Limit']).toBe('100');
      expect(info.headers['X-RateLimit-Remaining']).toBeDefined();
      expect(info.headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('한도 초과 시 Retry-After 헤더를 포함한다', () => {
      limiter = new TenantRateLimiter({
        plans: { free: { requestsPerMinute: 2, burstMultiplier: 1.0 } },
      });

      limiter.tryRequest('tenant-1', 'free');
      limiter.tryRequest('tenant-1', 'free');
      const exceeded = limiter.tryRequest('tenant-1', 'free');

      expect(exceeded.result.exceeded).toBe(true);
      expect(exceeded.headers['Retry-After']).toBeDefined();
      expect(parseInt(exceeded.headers['Retry-After'], 10)).toBeGreaterThan(0);
    });
  });

  describe('getStatus', () => {
    it('카운트 증가 없이 현재 상태를 반환한다', () => {
      limiter = new TenantRateLimiter();
      limiter.tryRequest('tenant-1', 'free');
      limiter.tryRequest('tenant-1', 'free');

      const status = limiter.getStatus('tenant-1', 'free');
      expect(status.result.count).toBe(2);

      // 다시 조회해도 카운트 동일
      const status2 = limiter.getStatus('tenant-1', 'free');
      expect(status2.result.count).toBe(2);
    });
  });

  describe('resetTenant', () => {
    it('특정 테넌트의 한도를 리셋한다', () => {
      limiter = new TenantRateLimiter();
      limiter.tryRequest('tenant-1', 'free');
      limiter.tryRequest('tenant-1', 'free');

      limiter.resetTenant('tenant-1');

      const status = limiter.getStatus('tenant-1', 'free');
      expect(status.result.count).toBe(0);
    });
  });

  describe('임계값 알림', () => {
    it('80% 임계값에서 콜백을 호출한다', () => {
      const notifications: Array<{ tenantId: string; percentage: number }> = [];
      limiter = new TenantRateLimiter({
        plans: { free: { requestsPerMinute: 10, burstMultiplier: 1.5 } },
        thresholds: [80],
        onThreshold: (tenantId, percentage) => {
          notifications.push({ tenantId, percentage });
        },
      });

      // 10개 한도, 버스트 15 -- 한도 대비 80% = 8개
      for (let i = 0; i < 9; i++) {
        limiter.tryRequest('tenant-1', 'free');
      }

      expect(notifications.length).toBeGreaterThanOrEqual(1);
      expect(notifications[0]?.percentage).toBe(80);
    });

    it('동일 임계값 알림을 중복 발행하지 않는다', () => {
      let callCount = 0;
      limiter = new TenantRateLimiter({
        plans: { free: { requestsPerMinute: 10, burstMultiplier: 2.0 } },
        thresholds: [80],
        onThreshold: () => { callCount++; },
      });

      for (let i = 0; i < 15; i++) {
        limiter.tryRequest('tenant-1', 'free');
      }

      // 80% 임계값은 한 번만
      expect(callCount).toBe(1);
    });
  });

  describe('getStats', () => {
    it('전체 통계를 반환한다', () => {
      limiter = new TenantRateLimiter({
        overrides: {
          'vip': { requestsPerMinute: 5000, burstMultiplier: 2.0 },
        },
      });
      limiter.tryRequest('tenant-1', 'free');
      limiter.tryRequest('tenant-2', 'standard');

      const stats = limiter.getStats();
      expect(stats.activeKeys).toBe(2);
      expect(stats.overrideCount).toBe(1);
      expect(stats.plans.free.requestsPerMinute).toBe(100);
    });
  });
});
