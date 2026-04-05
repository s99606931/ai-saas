// 프록시 라우트 등록
// Design Ref: DESIGN-MTU-P04 라우팅 설계
// Plan SC: FR-P04.1, FR-P04.2, FR-P04.3, FR-P04.11

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import httpProxy from '@fastify/http-proxy';
import { SERVICE_REGISTRY, getServiceEntry } from '../registry/service-registry.js';
import { dataGradeMiddleware } from '../middleware/data-grade.middleware.js';

const AUTH_SERVICE_URL = `http://localhost:${process.env['AUTH_SERVICE_PORT'] ?? '3001'}`;

/**
 * 인증 검사 preHandler (FR-P04.2)
 * auth-service의 /auth/verify 엔드포인트를 통해 JWT 검증
 * CSAP D-08-01: 중앙 인증 게이트웨이
 */
async function authPreHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_NO_TOKEN', message: '인증 토큰이 필요합니다' },
    });
    return;
  }

  try {
    const verifyResponse = await fetch(`${AUTH_SERVICE_URL}/auth/verify`, {
      headers: { authorization: authHeader },
    });

    if (!verifyResponse.ok) {
      const errorBody = await verifyResponse.json() as { error?: { code?: string; message?: string } };
      await reply.status(401).send({
        success: false,
        error: errorBody.error ?? { code: 'AUTH_TOKEN_INVALID', message: '인증 실패' },
      });
      return;
    }

    const { data } = await verifyResponse.json() as { data: unknown };
    (request as FastifyRequest & { user?: unknown }).user = data;
  } catch {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_SERVICE_UNAVAILABLE', message: '인증 서비스에 연결할 수 없습니다' },
    });
  }
}

/**
 * 모든 플랫폼 서비스에 대한 프록시 라우트 등록
 *
 * /api/v1/{serviceId}/* -> 해당 서비스로 프록시
 */
export async function registerProxyRoutes(app: FastifyInstance): Promise<void> {
  // 정적 서비스 프록시 등록
  for (const [serviceId, entry] of Object.entries(SERVICE_REGISTRY)) {
    const preHandlers: ((req: FastifyRequest, reply: FastifyReply) => Promise<void>)[] = [];

    // FR-P04.2: 인증 필요 서비스에 auth preHandler 추가
    if (entry.requireAuth) {
      preHandlers.push(authPreHandler);
    }

    // FR-P04.6: AI 서비스에 데이터 등급 검증 미들웨어 추가
    if (serviceId === 'ai') {
      preHandlers.push(dataGradeMiddleware(['O']));
    }

    await app.register(httpProxy, {
      upstream: entry.url,
      prefix: `/api/v1/${serviceId}`,
      rewritePrefix: `/${serviceId === 'auth' ? 'auth' : serviceId}`,
      http2: false,
      preHandler: preHandlers.length > 0 ? preHandlers : undefined,
    });

    app.log.info(`프록시 등록: /api/v1/${serviceId} -> ${entry.url}${entry.requireAuth ? ' [인증]' : ''}${serviceId === 'ai' ? ' [등급검증]' : ''}`);
  }

  // 동적 서비스 라우트 (비즈니스 플러그인)
  // Plan SC: FR-P04.11
  app.all('/api/v1/plugins/:pluginId/*', {
    preHandler: [authPreHandler],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { pluginId: string; '*': string };
    const pluginEntry = getServiceEntry(params.pluginId);

    if (!pluginEntry) {
      await reply.status(404).send({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: `서비스 '${params.pluginId}'를 찾을 수 없습니다`,
        },
      });
      return;
    }

    // 동적 프록시 전달 (undici fetch) — 쿼리스트링 보존
    const targetPath = params['*'] || '';
    const queryString = (request.url.split('?')[1]) ?? '';
    const targetUrl = queryString
      ? `${pluginEntry.url}/${targetPath}?${queryString}`
      : `${pluginEntry.url}/${targetPath}`;

    try {
      const proxyResponse = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'content-type': request.headers['content-type'] ?? 'application/json',
          'authorization': request.headers.authorization ?? '',
          'x-tenant-id': (request.headers['x-tenant-id'] as string) ?? '',
          'x-forwarded-for': request.ip,
        },
        body: request.method !== 'GET' && request.method !== 'HEAD'
          ? JSON.stringify(request.body)
          : undefined,
      });

      const responseBody = await proxyResponse.text();
      await reply
        .status(proxyResponse.status)
        .headers(Object.fromEntries(
          [...proxyResponse.headers.entries()].filter(
            ([key]) => !['transfer-encoding', 'connection'].includes(key.toLowerCase()),
          ),
        ))
        .send(responseBody);
    } catch (error) {
      app.log.error(`동적 프록시 실패: ${targetUrl}`, error);
      await reply.status(502).send({
        success: false,
        error: {
          code: 'PROXY_ERROR',
          message: `서비스 '${params.pluginId}' 연결 실패`,
        },
      });
    }
  });
}
