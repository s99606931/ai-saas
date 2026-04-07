// 프록시 라우트 등록
// Design Ref: DESIGN-MTU-P04 라우팅 설계
// Plan SC: FR-P04.1, FR-P04.2, FR-P04.3, FR-P04.11

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import httpProxy from '@fastify/http-proxy';
import { SERVICE_REGISTRY, getServiceEntry } from '../registry/service-registry.js';
import { dataGradeMiddleware } from '../middleware/data-grade.middleware.js';

const AUTH_SERVICE_URL = process.env['AUTH_SVC_URL'] ?? 'http://auth-service:3001';

interface JwtUser {
  sub?: string;
  tenantId?: string;
  role?: string;
  permissions?: string[];
}

/** 역할별 기본 권한 매핑 (CSAP D-08-05) */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['audit:read', 'security:read', 'admin:all'],
  TENANT_ADMIN: ['audit:read'],
  AUDITOR: ['audit:read', 'security:read'],
  USER: [],
  VIEWER: [],
};

/**
 * 인증 검사 preHandler (FR-P04.2)
 * auth-service의 /auth/verify 엔드포인트를 통해 JWT 검증
 * CSAP D-08-01: 중앙 인증 게이트웨이
 * 인증 성공 시 x-user-id, x-user-tenant-id, x-user-role 헤더 주입 (하위 서비스 actor 추적용)
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

    const { data } = await verifyResponse.json() as { data: JwtUser };
    (request as FastifyRequest & { user?: JwtUser }).user = data;

    // 하위 서비스 actor 추적 및 테넌트 격리를 위한 헤더 주입 (CSAP D-06, D-08)
    const mutableHeaders = request.headers as Record<string, string | undefined>;
    mutableHeaders['x-user-id'] = data.sub ?? 'anonymous';
    mutableHeaders['x-user-tenant-id'] = data.tenantId ?? '';
    mutableHeaders['x-user-role'] = data.role ?? '';
    // INTERNAL_SERVICE_KEY: 미설정 시 헤더 미주입 (빈 문자열 폴백 방지 MEDIUM-02)
    const internalKey = process.env['INTERNAL_SERVICE_KEY'];
    if (internalKey) {
      mutableHeaders['x-internal-service-key'] = internalKey;
    }
  } catch {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_SERVICE_UNAVAILABLE', message: '인증 서비스에 연결할 수 없습니다' },
    });
  }
}

/**
 * RBAC 권한 검사 preHandler 팩토리 (FR-P04.2, CSAP D-08-05)
 * service-registry에 선언된 requiredPermissions를 JWT 클레임과 비교
 */
function makePermissionPreHandler(requiredPermissions: string[]) {
  return async function permissionPreHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const user = (request as FastifyRequest & { user?: JwtUser }).user;
    if (!user) {
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: '인증이 필요합니다' },
      });
      return;
    }

    const userPermissions = user.permissions ?? ROLE_PERMISSIONS[user.role ?? ''] ?? [];
    const hasAll = requiredPermissions.every(
      (p) => userPermissions.includes(p) || userPermissions.includes('admin:all'),
    );

    if (!hasAll) {
      await reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: '이 리소스에 접근할 권한이 없습니다' },
      });
      return;
    }
  };
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

    // FR-P04.2 RBAC: requiredPermissions 검사 (CSAP D-08-05)
    if (entry.requiredPermissions?.length) {
      preHandlers.push(makePermissionPreHandler(entry.requiredPermissions));
    }

    // @fastify/http-proxy는 단일 함수 preHandler만 허용 — 복합 함수로 래핑
    const compositePreHandler = preHandlers.length > 0
      ? async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
          for (const handler of preHandlers) {
            await handler(req, reply);
            if (reply.sent) return;
          }
        }
      : undefined;

    await app.register(httpProxy, {
      upstream: entry.url,
      prefix: `/api/v1/${serviceId}`,
      rewritePrefix: `/${serviceId === 'auth' ? 'auth' : serviceId}`,
      http2: false,
      preHandler: compositePreHandler,
    });

    app.log.info(`프록시 등록: /api/v1/${serviceId} -> ${entry.url}${entry.requireAuth ? ' [인증]' : ''}${serviceId === 'ai' ? ' [등급검증]' : ''}`);
  }

  // 동적 서비스 라우트 (비즈니스 플러그인)
  // Plan SC: FR-P04.11
  // CSAP D-08-05: 인증 + 플러그인별 requiredPermissions RBAC 검사
  app.all('/api/v1/plugins/:pluginId/*', {
    preHandler: authPreHandler,
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

    // 플러그인 requiredPermissions RBAC 검사 (MEDIUM-01, CSAP D-08-05)
    if (pluginEntry.requiredPermissions?.length) {
      const user = (request as FastifyRequest & { user?: JwtUser }).user;
      const userPermissions = user?.permissions ?? ROLE_PERMISSIONS[user?.role ?? ''] ?? [];
      const hasAll = pluginEntry.requiredPermissions.every(
        (p) => userPermissions.includes(p) || userPermissions.includes('admin:all'),
      );
      if (!hasAll) {
        await reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: '이 플러그인에 접근할 권한이 없습니다' },
        });
        return;
      }
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
          'x-user-id': (request.headers['x-user-id'] as string) ?? '',
          'x-user-tenant-id': (request.headers['x-user-tenant-id'] as string) ?? '',
          'x-user-role': (request.headers['x-user-role'] as string) ?? '',
          'x-internal-service-key': (request.headers['x-internal-service-key'] as string) ?? '',
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
      app.log.error({ err: error }, `동적 프록시 실패: ${targetUrl}`);
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
