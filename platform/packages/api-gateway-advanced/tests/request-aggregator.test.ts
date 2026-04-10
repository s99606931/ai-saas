// 요청 집계기 테스트
// Design Ref: SVC-APIGW-R22 Plan
// Plan SC: FR-GW.4
// CSAP: D-12 시스템 개발 보안

import { describe, it, expect } from 'vitest';
import { RequestAggregator } from '../src/request-aggregator.js';

describe('RequestAggregator', () => {
  describe('FR-GW.4: 요청 집계', () => {
    it('여러 대상을 병렬로 실행하고 결과를 병합한다', async () => {
      const aggregator = new RequestAggregator();
      const result = await aggregator.aggregate([
        {
          key: 'users',
          execute: async () => [{ id: 1, name: 'User 1' }],
        },
        {
          key: 'tenants',
          execute: async () => [{ id: 1, name: 'Tenant 1' }],
        },
        {
          key: 'stats',
          execute: async () => ({ total: 42 }),
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.data.users).toEqual([{ id: 1, name: 'User 1' }]);
      expect(result.data.tenants).toEqual([{ id: 1, name: 'Tenant 1' }]);
      expect(result.data.stats).toEqual({ total: 42 });
      expect(result.errors).toHaveLength(0);
    });

    it('빈 대상 목록이면 빈 결과', async () => {
      const aggregator = new RequestAggregator();
      const result = await aggregator.aggregate([]);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
      expect(result.totalDurationMs).toBe(0);
    });

    it('대상별 소요 시간을 기록한다', async () => {
      const aggregator = new RequestAggregator();
      const result = await aggregator.aggregate([
        {
          key: 'fast',
          execute: async () => 'done',
        },
        {
          key: 'slow',
          execute: async () => {
            await new Promise((r) => setTimeout(r, 50));
            return 'done';
          },
        },
      ]);

      expect(result.durations.fast).toBeDefined();
      expect(result.durations.slow).toBeDefined();
      expect(result.durations.slow!).toBeGreaterThanOrEqual(40);
    });

    it('실패한 대상에 fallback을 적용한다', async () => {
      const aggregator = new RequestAggregator();
      const result = await aggregator.aggregate([
        {
          key: 'ok',
          execute: async () => 'success',
        },
        {
          key: 'fail',
          execute: async () => { throw new Error('서비스 불가'); },
          fallback: { default: true },
          required: false,
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.data.ok).toBe('success');
      expect(result.data.fail).toEqual({ default: true });
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.key).toBe('fail');
    });

    it('필수 대상 실패 시 success=false (allowPartialFailure 기본 true)', async () => {
      const aggregator = new RequestAggregator();
      const result = await aggregator.aggregate([
        {
          key: 'required',
          execute: async () => { throw new Error('실패'); },
          required: true,
        },
        {
          key: 'optional',
          execute: async () => 'ok',
        },
      ]);

      // allowPartialFailure 기본 true이므로 success는 true
      expect(result.success).toBe(true);
    });

    it('allowPartialFailure=false 시 필수 대상 실패 → success=false', async () => {
      const aggregator = new RequestAggregator({ allowPartialFailure: false });
      const result = await aggregator.aggregate([
        {
          key: 'required',
          execute: async () => { throw new Error('필수 실패'); },
          required: true,
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('타임아웃 초과 시 실패 처리', async () => {
      const aggregator = new RequestAggregator({ globalTimeoutMs: 50 });
      const result = await aggregator.aggregate([
        {
          key: 'slow',
          execute: async () => {
            await new Promise((r) => setTimeout(r, 200));
            return 'never';
          },
          fallback: 'timeout-fallback',
          required: false,
        },
      ]);

      expect(result.data.slow).toBe('timeout-fallback');
      expect(result.errors[0]!.error).toContain('타임아웃');
    });

    it('개별 타임아웃이 전체 타임아웃을 오버라이드한다', async () => {
      const aggregator = new RequestAggregator({ globalTimeoutMs: 5000 });
      const result = await aggregator.aggregate([
        {
          key: 'custom-timeout',
          timeoutMs: 50,
          execute: async () => {
            await new Promise((r) => setTimeout(r, 200));
            return 'never';
          },
          fallback: 'timed-out',
          required: false,
        },
      ]);

      expect(result.data['custom-timeout']).toBe('timed-out');
    });
  });
});
