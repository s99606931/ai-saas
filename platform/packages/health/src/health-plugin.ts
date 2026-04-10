// Fastify 헬스체크 플러그인
// Design Ref: SVC-HEALTH-R10 Plan
// Plan SC: FR-HEALTH.2
// CSAP: D-07 가용성

import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { HealthChecker, type DependencyChecker } from './health-checker.js';

declare module 'fastify' {
  interface FastifyInstance {
    healthChecker: HealthChecker;
  }
}

export interface HealthPluginOptions {
  serviceName: string;
  version?: string;
  checkers?: DependencyChecker[];
}

/**
 * Fastify 헬스체크 플러그인
 *
 * 등록 시 자동으로 /health, /ready, /health/detail 엔드포인트 생성
 * Kubernetes livenessProbe/readinessProbe 호환
 */
export const healthPlugin = fp(
  async (fastify: FastifyInstance, opts: HealthPluginOptions) => {
    const checker = new HealthChecker(opts.serviceName, opts.version);

    if (opts.checkers) {
      for (const c of opts.checkers) {
        checker.addChecker(c);
      }
    }

    fastify.decorate('healthChecker', checker);

    // Kubernetes livenessProbe
    fastify.get('/health', async () => {
      return checker.liveness();
    });

    // Kubernetes readinessProbe
    fastify.get('/ready', async (_, reply) => {
      const result = await checker.readiness();
      if (!result.ready) {
        await reply.status(503).send({
          ready: false,
          dependencies: result.dependencies,
        });
        return;
      }
      return { ready: true, dependencies: result.dependencies };
    });

    // 상세 상태 (관리자용)
    fastify.get('/health/detail', async () => {
      return checker.check();
    });

    // SLA 메트릭
    fastify.get('/health/sla', async () => {
      return { success: true, data: checker.calculateSLA() };
    });
  },
  {
    name: '@public-saas/health',
    fastify: '5.x',
  },
);
