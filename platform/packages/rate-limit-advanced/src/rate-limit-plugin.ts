// Rate Limit Advanced Fastify 플러그인
// Design Ref: SVC-RATELIMIT-R19 Plan
// Plan SC: FR-RL.5, FR-RL.6
// CSAP: D-10 접근 제어

import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { TenantRateLimiter, type TenantRateLimiterOptions, type PlanLevel } from './tenant-rate-limiter.js';

/**
 * 키 생성 전략
 */
export type KeyStrategy = 'ip' | 'tenant' | 'user' | 'custom';

/**
 * Rate Limit Advanced 플러그인 옵션
 */
export interface RateLimitAdvancedPluginOptions extends FastifyPluginOptions {
  /** TenantRateLimiter 옵션 */
  limiterOptions?: TenantRateLimiterOptions;
  /** 키 생성 전략 (기본: 'tenant') */
  keyStrategy?: KeyStrategy;
  /** 커스텀 키 생성 함수 */
  keyGenerator?: (request: FastifyRequest) => string;
  /** 요금제 조회 함수 (테넌트 ID → 요금제) */
  planResolver?: (tenantId: string) => PlanLevel;
  /** 제외 경로 (기본: ['/health', '/ready', '/metadata']) */
  excludePaths?: string[];
  /** /rate-limit/stats 엔드포인트 등록 (기본: true) */
  exposeStats?: boolean;
  /** 한도 초과 시 커스텀 응답 */
  onExceeded?: (request: FastifyRequest, reply: FastifyReply, retryAfter: number) => void;
}

// Fastify 타입 확장
declare module 'fastify' {
  interface FastifyInstance {
    rateLimiter: TenantRateLimiter;
  }
}

/** 기본 제외 경로 */
const DEFAULT_EXCLUDE = ['/health', '/ready', '/metadata', '/health/detail', '/health/sla', '/events'];

/**
 * rateLimitAdvancedPlugin -- 고급 Rate Limiting Fastify 플러그인
 *
 * 기능:
 * - 테넌트별 요금제 기반 차등 Rate Limit
 * - Sliding Window Counter 알고리즘
 * - 버스트 허용 (Token Bucket 하이브리드)
 * - RFC 표준 응답 헤더 (X-RateLimit-*, Retry-After)
 * - 통계 및 모니터링 엔드포인트
 */
async function rateLimitAdvancedPluginImpl(
  app: FastifyInstance,
  opts: RateLimitAdvancedPluginOptions,
): Promise<void> {
  const limiter = new TenantRateLimiter(opts.limiterOptions);
  const excludePaths = [...DEFAULT_EXCLUDE, ...(opts.excludePaths ?? [])];
  const keyStrategy = opts.keyStrategy ?? 'tenant';
  const planResolver = opts.planResolver ?? (() => 'free' as PlanLevel);

  // Fastify decorator 등록
  app.decorate('rateLimiter', limiter);

  // onRequest 훅: Rate Limit 검사
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // 제외 경로 확인
    if (excludePaths.some((p) => request.url.startsWith(p))) {
      return;
    }

    // 키 생성
    const key = resolveKey(request, keyStrategy, opts.keyGenerator);
    if (!key) return; // 키를 결정할 수 없으면 통과

    // 요금제 조회
    const plan = planResolver(key);

    // Rate Limit 검사
    const info = limiter.tryRequest(key, plan);

    // 응답 헤더 설정 (항상)
    for (const [header, value] of Object.entries(info.headers)) {
      reply.header(header, value);
    }

    // 한도 초과
    if (info.result.exceeded) {
      if (opts.onExceeded) {
        opts.onExceeded(request, reply, Math.ceil(info.result.retryAfterMs / 1000));
        return;
      }

      reply.status(429).send({
        error: 'Too Many Requests',
        message: `요청 한도를 초과했습니다. ${Math.ceil(info.result.retryAfterMs / 1000)}초 후 재시도하십시오.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(info.result.retryAfterMs / 1000),
        limit: info.limit,
        plan: info.plan,
      });
    }
  });

  // 통계 엔드포인트 (FR-RL.6)
  if (opts.exposeStats !== false) {
    app.get('/rate-limit/stats', async () => ({
      success: true,
      data: limiter.getStats(),
    }));
  }

  // 서버 종료 시 리소스 정리
  app.addHook('onClose', async () => {
    limiter.destroy();
  });
}

/**
 * 요청에서 Rate Limit 키를 추출
 */
function resolveKey(
  request: FastifyRequest,
  strategy: KeyStrategy,
  customGenerator?: (request: FastifyRequest) => string,
): string {
  switch (strategy) {
    case 'ip':
      return request.ip;
    case 'tenant': {
      const tenantId = request.headers['x-tenant-id'];
      return typeof tenantId === 'string' ? tenantId : request.ip;
    }
    case 'user': {
      const userId = request.headers['x-user-id'];
      return typeof userId === 'string' ? userId : request.ip;
    }
    case 'custom':
      return customGenerator ? customGenerator(request) : request.ip;
    default:
      return request.ip;
  }
}

export const rateLimitAdvancedPlugin = fp(rateLimitAdvancedPluginImpl, {
  name: '@public-saas/rate-limit-advanced',
  fastify: '5.x',
});
