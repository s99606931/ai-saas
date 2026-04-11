// 시크릿 관리자 Fastify 플러그인
// Design Ref: SVC-SECRETMGR-R24 Plan
// Plan SC: FR-SM.6
// CSAP: D-09, D-08

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { SecretManager, type SecretManagerOptions } from './secret-manager.js';

declare module 'fastify' {
  interface FastifyInstance {
    secrets: SecretManager;
  }
}

export interface SecretPluginOptions extends FastifyPluginOptions {
  managerOptions: SecretManagerOptions;
  exposeStats?: boolean;
}

async function secretPluginHandler(
  app: FastifyInstance,
  opts: SecretPluginOptions,
): Promise<void> {
  const manager = new SecretManager(opts.managerOptions);
  const exposeStats = opts.exposeStats !== false;

  app.decorate('secrets', manager);

  if (exposeStats) {
    app.get('/secrets/stats', async () => {
      return {
        success: true,
        data: manager.getStats(),
        timestamp: new Date().toISOString(),
      };
    });
  }

  app.addHook('onClose', async () => {
    manager.destroy();
  });
}

export const secretPlugin = fp(secretPluginHandler, {
  name: '@public-saas/secret-manager',
  fastify: '5.x',
});
