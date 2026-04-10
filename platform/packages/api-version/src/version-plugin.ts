// Fastify API 버전 관리 플러그인
// Design Ref: SVC-APIVER-R9 Plan
// Plan SC: FR-APIVER.2, FR-APIVER.3
// CSAP: D-12 시스템 개발 보안

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ApiVersionManager, type ApiVersionConfig } from './version-manager.js';

declare module 'fastify' {
  interface FastifyInstance {
    apiVersionManager: ApiVersionManager;
  }
  interface FastifyRequest {
    apiVersion?: string;
  }
}

export interface VersionPluginOptions {
  versions: ApiVersionConfig[];
  defaultVersion?: string;
}

/**
 * Fastify API 버전 관리 플러그인
 *
 * - URL에서 자동 버전 추출
 * - Deprecated 버전 경고 헤더 자동 설정
 * - Sunset 버전 접근 차단
 */
export const versionPlugin = fp(
  async (fastify: FastifyInstance, opts: VersionPluginOptions) => {
    const manager = new ApiVersionManager();

    for (const config of opts.versions) {
      manager.registerVersion(config);
    }

    if (opts.defaultVersion) {
      manager.setDefaultVersion(opts.defaultVersion);
    }

    fastify.decorate('apiVersionManager', manager);

    // 요청마다 버전 추출 + 헤더 설정
    fastify.addHook('onRequest', async (request, reply) => {
      const { version } = manager.extractVersion(request.url);
      request.apiVersion = version;

      // Sunset 버전 차단
      if (manager.isValidVersion(version) && !manager.isUsableVersion(version)) {
        await reply.status(410).send({
          success: false,
          error: {
            code: 'API_VERSION_SUNSET',
            message: `API 버전 ${version}은 종료되었습니다.`,
            ...manager.getDeprecationHeaders(version),
          },
        });
        return;
      }

      // Deprecated 경고 헤더 설정
      const headers = manager.getDeprecationHeaders(version);
      for (const [key, value] of Object.entries(headers)) {
        void reply.header(key, value);
      }
    });

    // 버전 정보 엔드포인트
    fastify.get('/api/versions', async () => {
      return {
        success: true,
        data: {
          default: manager.getDefaultVersion(),
          versions: manager.listVersions(),
        },
      };
    });
  },
  {
    name: '@public-saas/api-version',
    fastify: '5.x',
  },
);

/**
 * 버전별 라우트 등록 헬퍼
 *
 * @param app - Fastify 인스턴스
 * @param version - API 버전
 * @param basePath - 기본 경로
 * @param routes - 라우트 등록 함수
 */
export async function registerVersionedRoutes(
  app: FastifyInstance,
  version: string,
  basePath: string,
  routes: (prefix: string) => Promise<void> | void,
): Promise<void> {
  const prefix = `/${version}${basePath.startsWith('/') ? basePath : `/${basePath}`}`;
  await routes(prefix);
}
