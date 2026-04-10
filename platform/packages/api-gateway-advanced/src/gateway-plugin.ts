// API Gateway Advanced Fastify 플러그인
// Design Ref: SVC-APIGW-R22 Plan
// Plan SC: FR-GW.5
// CSAP: D-08, D-10

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { ResponseCache, type ResponseCacheOptions } from './response-cache.js';
import { UsageAnalytics, type UsageAnalyticsOptions } from './usage-analytics.js';
import { RequestAggregator, type RequestAggregatorOptions } from './request-aggregator.js';

/**
 * Fastify 인스턴스 타입 확장
 */
declare module 'fastify' {
  interface FastifyInstance {
    gateway: {
      cache: ResponseCache;
      analytics: UsageAnalytics;
      aggregator: RequestAggregator;
    };
  }
}

/**
 * 게이트웨이 플러그인 옵션
 */
export interface GatewayPluginOptions extends FastifyPluginOptions {
  /** 캐시 옵션 */
  cacheOptions?: ResponseCacheOptions;
  /** 사용량 분석 옵션 */
  analyticsOptions?: UsageAnalyticsOptions;
  /** 요청 집계 옵션 */
  aggregatorOptions?: RequestAggregatorOptions;
  /** 캐시 통계 엔드포인트 노출 (기본: true) */
  exposeCacheStats?: boolean;
  /** 사용량 리포트 엔드포인트 노출 (기본: true) */
  exposeAnalytics?: boolean;
}

async function gatewayPluginHandler(
  app: FastifyInstance,
  opts: GatewayPluginOptions,
): Promise<void> {
  const cache = new ResponseCache(opts.cacheOptions);
  const analytics = new UsageAnalytics(opts.analyticsOptions);
  const aggregator = new RequestAggregator(opts.aggregatorOptions);

  const exposeCacheStats = opts.exposeCacheStats !== false;
  const exposeAnalytics = opts.exposeAnalytics !== false;

  app.decorate('gateway', { cache, analytics, aggregator });

  // 캐시 통계 엔드포인트
  if (exposeCacheStats) {
    app.get('/gateway/cache/stats', async () => {
      return {
        success: true,
        data: cache.getStats(),
        timestamp: new Date().toISOString(),
      };
    });
  }

  // 사용량 리포트 엔드포인트
  if (exposeAnalytics) {
    app.get('/gateway/analytics', async () => {
      return {
        success: true,
        data: analytics.getReport(),
        timestamp: new Date().toISOString(),
      };
    });
  }

  // 캐시 정리 시 리소스 해제
  app.addHook('onClose', async () => {
    cache.destroy();
  });
}

export const gatewayPlugin = fp(gatewayPluginHandler, {
  name: '@public-saas/api-gateway-advanced',
  fastify: '5.x',
});
