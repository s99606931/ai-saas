// API 게이트웨이 OpenAPI 문서 자동 생성
// Design Ref: DESIGN-MTU-Q1 §2 FR-P04.10
// Plan SC: FR-P04.10
// CSAP: D-12 시스템 개발 보안 — API 문서화

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Fastify 플러그인: OpenAPI 3.0 문서 + Swagger UI
 * 개발 환경 기본 활성화, 운영 환경은 ENABLE_SWAGGER=true 필요
 */
async function swaggerPlugin(app: FastifyInstance): Promise<void> {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const enableSwagger = process.env['ENABLE_SWAGGER'] === 'true';

  // 운영 환경에서 명시적으로 활성화하지 않으면 스킵
  if (isProduction && !enableSwagger) {
    app.log.info('OpenAPI 문서: 운영 환경에서 비활성화 (ENABLE_SWAGGER=true로 활성화)');
    return;
  }

  // @fastify/swagger: OpenAPI 3.0 스펙 생성
  const swagger = await import('@fastify/swagger');
  await app.register(swagger.default, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: '공공기관 SaaS 플랫폼 API',
        description: 'API 게이트웨이를 통한 통합 서비스 API. CSAP 중/상 등급 준수.',
        version: '1.0.0',
        contact: {
          name: '공공기관 SaaS 프레임워크',
        },
      },
      servers: [
        {
          url: `http://localhost:${process.env['API_GATEWAY_PORT'] ?? '3000'}`,
          description: '로컬 개발 서버',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT 인증 토큰 (CSAP D-08-01)',
          },
        },
      },
      tags: [
        { name: 'auth', description: '인증 서비스 (로그인/로그아웃/토큰 갱신)' },
        { name: 'users', description: '사용자 관리 (CRUD + 역할 + 비밀번호)' },
        { name: 'tenants', description: '테넌트 관리 (격리, N2SF N-03)' },
        { name: 'subscriptions', description: '구독 관리' },
        { name: 'billing', description: '빌링 서비스' },
        { name: 'ai', description: 'AI 서비스 (N2SF N-05 등급 검증)' },
        { name: 'audit', description: '감사 로그 (CSAP D-06, append-only)' },
        { name: 'compliance', description: 'CSAP/N2SF 준수 현황' },
        { name: 'notifications', description: '알림 서비스 (이메일/인앱/웹훅)' },
        { name: 'files', description: '파일 관리 (AES-256 암호화)' },
        { name: 'security', description: '보안 모니터링' },
        { name: 'gateway', description: 'API 게이트웨이 관리' },
      ],
    },
  });

  // @fastify/swagger-ui: Swagger UI 제공
  const swaggerUi = await import('@fastify/swagger-ui');
  await app.register(swaggerUi.default, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
    },
  });

  app.log.info('OpenAPI 문서: /api/docs 에서 Swagger UI 활성화');
}

export default fp(swaggerPlugin, {
  name: 'swagger',
  fastify: '5.x',
});
