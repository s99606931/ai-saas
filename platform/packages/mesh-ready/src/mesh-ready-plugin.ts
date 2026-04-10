// 서비스 메시 준비 Fastify 플러그인 (통합)
// Design Ref: SVC-MESH-R13 Plan
// Plan SC: FR-MESH.1
// CSAP: D-10 네트워크 보안

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { ServiceMetadata, type ServiceMetadataConfig } from './service-metadata.js';
import { TraceContextPropagator } from './trace-context-propagator.js';
import { GracefulShutdown, type GracefulShutdownOptions } from './graceful-shutdown.js';

/**
 * 서비스 메시 준비 플러그인 옵션
 */
export interface MeshReadyPluginOptions extends FastifyPluginOptions {
  /** 서비스 메타데이터 설정 (필수) */
  service: ServiceMetadataConfig;
  /** 그레이스풀 셧다운 옵션 */
  shutdown?: GracefulShutdownOptions;
  /** 추적 헤더 전파 비활성화 */
  disableTracing?: boolean;
  /** 그레이스풀 셧다운 비활성화 */
  disableShutdown?: boolean;
  /** /metadata 엔드포인트 비활성화 */
  disableMetadataEndpoint?: boolean;
}

/**
 * mesh decorator 타입
 */
export interface MeshDecorator {
  /** 서비스 메타데이터 관리자 */
  metadata: ServiceMetadata;
  /** 추적 컨텍스트 전파자 */
  tracer: TraceContextPropagator;
  /** 그레이스풀 셧다운 관리자 */
  shutdown: GracefulShutdown;
  /** 서비스 이름 */
  serviceName: string;
  /** 서비스 버전 */
  serviceVersion: string;
}

// Fastify 타입 확장
declare module 'fastify' {
  interface FastifyInstance {
    mesh: MeshDecorator;
  }
}

/**
 * meshReadyPlugin -- 서비스 메시 준비 통합 플러그인
 *
 * 기능:
 * - 서비스 메타데이터 표준화 (/metadata 엔드포인트)
 * - W3C TraceContext + B3 분산 추적 헤더 전파
 * - SIGTERM 그레이스풀 셧다운
 *
 * 사용 예:
 * ```typescript
 * await app.register(meshReadyPlugin, {
 *   service: { name: 'auth-service', version: '0.1.0' },
 * });
 * ```
 */
async function meshReadyPluginImpl(
  app: FastifyInstance,
  opts: MeshReadyPluginOptions,
): Promise<void> {
  const metadata = new ServiceMetadata(opts.service);
  const tracer = new TraceContextPropagator();
  const shutdown = new GracefulShutdown(opts.shutdown);

  // Fastify decorator 등록
  app.decorate('mesh', {
    metadata,
    tracer,
    shutdown,
    serviceName: metadata.getName(),
    serviceVersion: metadata.getVersion(),
  });

  // 분산 추적 헤더 전파 (onRequest 훅)
  if (!opts.disableTracing) {
    app.addHook('onRequest', async (request, reply) => {
      tracer.onRequestHook(request, reply);
    });
  }

  // 그레이스풀 셧다운 등록
  if (!opts.disableShutdown) {
    shutdown.registerWithFastify(app);
  }

  // /metadata 엔드포인트 등록
  if (!opts.disableMetadataEndpoint) {
    app.get('/metadata', async () => {
      return {
        success: true,
        data: metadata.getMetadata(),
      };
    });
  }
}

export const meshReadyPlugin = fp(meshReadyPluginImpl, {
  name: '@public-saas/mesh-ready',
  fastify: '5.x',
});
