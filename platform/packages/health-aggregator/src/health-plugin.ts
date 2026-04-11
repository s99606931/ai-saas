// 헬스체크 집계기 Fastify 플러그인
// Design Ref: SVC-HEALTHAGG-R23 Plan
// Plan SC: FR-HA.6
// CSAP: D-10, D-14

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { HealthAggregator, type HealthAggregatorOptions } from './health-aggregator.js';

declare module 'fastify' {
  interface FastifyInstance {
    healthAggregator: HealthAggregator;
  }
}

export interface HealthPluginOptions extends FastifyPluginOptions {
  aggregatorOptions?: HealthAggregatorOptions;
  exposeAggregate?: boolean;
  exposeServices?: boolean;
}

async function healthPluginHandler(
  app: FastifyInstance,
  opts: HealthPluginOptions,
): Promise<void> {
  const aggregator = new HealthAggregator(opts.aggregatorOptions);
  const exposeAggregate = opts.exposeAggregate !== false;
  const exposeServices = opts.exposeServices !== false;

  app.decorate('healthAggregator', aggregator);

  if (exposeAggregate) {
    app.get('/health/aggregate', async (_request, reply) => {
      const result = await aggregator.checkAll();
      const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;
      reply.status(statusCode);
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    });
  }

  if (exposeServices) {
    app.get('/health/services', async () => {
      const names = aggregator.getRegisteredServices();
      const statuses = names.map((name) => aggregator.getServiceStatus(name)).filter(Boolean);
      return {
        success: true,
        data: { count: statuses.length, services: statuses },
        timestamp: new Date().toISOString(),
      };
    });

    app.get('/health/services/:name', async (request, reply) => {
      const params = request.params as { name: string };
      const status = await aggregator.checkService(params.name);
      if (!status) {
        reply.status(404);
        return { success: false, error: '서비스를 찾을 수 없습니다', code: 'SERVICE_NOT_FOUND' };
      }
      return { success: true, data: status, timestamp: new Date().toISOString() };
    });
  }
}

export const healthPlugin = fp(healthPluginHandler, {
  name: '@public-saas/health-aggregator',
  fastify: '5.x',
});
