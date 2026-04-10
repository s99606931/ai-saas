// Fastify 캐시 플러그인
// Design Ref: SVC-CACHE-R7 Plan
// Plan SC: FR-CACHE.1
// CSAP: D-07 가용성

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CacheStore, type CacheConfig } from './cache-store.js';

declare module 'fastify' {
  interface FastifyInstance {
    cache: CacheStore;
  }
}

export interface CachePluginOptions {
  config?: Partial<CacheConfig>;
}

/**
 * Fastify 캐시 플러그인
 *
 * 서비스 레벨에서 캐시 스토어를 등록하고,
 * 라우트 핸들러에서 `fastify.cache`로 접근 가능하게 함
 */
export const cachePlugin = fp(
  async (fastify: FastifyInstance, opts: CachePluginOptions) => {
    const store = new CacheStore(opts.config);

    // Fastify decorator로 등록
    fastify.decorate('cache', store);

    // 서버 종료 시 캐시 정리
    fastify.addHook('onClose', async () => {
      store.clear();
    });
  },
  {
    name: '@public-saas/cache',
    fastify: '5.x',
  },
);

/**
 * 캐시 미들웨어 -- 자동 캐싱을 위한 GET 라우트 데코레이터
 *
 * @param service - 서비스명 (키 네임스페이스)
 * @param resource - 리소스명 (키 네임스페이스)
 * @param ttlSeconds - TTL (초)
 */
export function createCacheMiddleware(service: string, resource: string, ttlSeconds: number = 300) {
  return async function cacheMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const cache = (request.server as FastifyInstance & { cache: CacheStore }).cache;
    if (!cache) return;

    // 테넌트 ID 추출 (CSAP D-08-05)
    const tenantId =
      (request.headers['x-tenant-id'] as string) ?? (request.headers['x-user-tenant-id'] as string) ?? 'global';

    // 쿼리 파라미터를 키에 포함 (같은 URL이라도 파라미터별 캐시)
    const queryString = request.url.includes('?') ? request.url.split('?')[1] : '';
    const identifier = queryString || 'default';

    const key = cache.buildKey(service, tenantId, resource, identifier);
    const cached = cache.get(key);

    if (cached !== undefined) {
      // 캐시 히트 헤더 설정
      void reply.header('X-Cache', 'HIT');
      void reply.header('X-Cache-Key', key);
      void reply.send(cached);
      return;
    }

    // 캐시 미스 -- 원본 요청을 처리한 후 응답을 캐싱
    // 요청 컨텍스트에 캐시 메타데이터 저장 (Fastify 5 config readonly 대응)
    void reply.header('X-Cache', 'MISS');
    (request as unknown as Record<string, unknown>)['_cacheKey'] = key;
    (request as unknown as Record<string, unknown>)['_cacheTenantId'] = tenantId;
    (request as unknown as Record<string, unknown>)['_cacheTtl'] = ttlSeconds;
  };
}
