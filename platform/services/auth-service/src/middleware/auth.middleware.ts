// JWT 인증 미들웨어 (Fastify 플러그인)
// Design Ref: DESIGN-MTU-P01 Section 3
// Plan SC: FR-P01.2, FR-P01.6
// CSAP: D-08-01 인증, N2SF N-03 테넌트 격리

import type { FastifyRequest, FastifyReply, FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { verifyToken } from '../lib/jwt.js';
import { isTokenBlacklisted } from '../lib/session.js';
import type { TokenPayload } from '@public-saas/types';

// Fastify 요청 타입 확장
declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

/**
 * JWT 인증 미들웨어
 *
 * - Authorization: Bearer {token} 헤더에서 토큰 추출
 * - RS256 검증 + 만료 확인 + 블랙리스트 확인
 * - request.user에 페이로드 바인딩 (tenantId 포함)
 */
const authPlugin: FastifyPluginCallback = (app, _opts, done) => {
  app.decorateRequest('user', undefined);

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // 공개 경로 제�� (CSAP D-08-01: 정확한 경로 매칭으로 인증 우회 방지)
    const urlPath = request.url.split('?')[0] ?? request.url;
    const publicPaths = ['/health', '/ready', '/auth/login', '/auth/refresh'];
    if (publicPaths.some((p) => urlPath === p)) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_NO_TOKEN', message: '인증 토큰이 필요합니다' },
      });
      return;
    }

    const token = authHeader.slice(7);

    try {
      // 블랙리스트 확인
      if (await isTokenBlacklisted(token)) {
        await reply.status(401).send({
          success: false,
          error: { code: 'AUTH_TOKEN_REVOKED', message: '토큰이 무효화되었습니다' },
        });
        return;
      }

      // 토큰 검증
      const payload = await verifyToken(token);
      request.user = payload;
    } catch {
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_TOKEN_INVALID', message: '유효하지 않거나 만료된 토큰입니다' },
      });
      return;
    }
  });

  done();
};

export default fp(authPlugin, {
  name: 'auth-middleware',
  fastify: '5.x',
});
