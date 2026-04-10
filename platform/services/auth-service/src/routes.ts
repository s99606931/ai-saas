// 인증 라우트 등록
// Design Ref: SVC-AUTH-R1 DESIGN §전체
// Plan SC: FR-AUTH.1~FR-AUTH.7

import type { FastifyInstance } from 'fastify';
import { loginHandler } from './handlers/login.handler.js';
import { logoutHandler } from './handlers/logout.handler.js';
import { refreshHandler } from './handlers/refresh.handler.js';
import { verifyHandler } from './handlers/verify.handler.js';
import { mfaSetupHandler, mfaVerifyHandler, mfaDisableHandler } from './handlers/mfa.handler.js';
import { invalidateAllSessionsHandler } from './handlers/session-invalidate.handler.js';
import { passwordChangeHandler } from './handlers/password-change.handler.js';
import { rateLimitMiddleware } from './middleware/rate-limit.middleware.js';
import { requireServiceAuth } from './middleware/service-auth.middleware.js';

// Rate Limiting 설정 (환경 변수로 조정 가능)
const LOGIN_RATE_LIMIT = rateLimitMiddleware({
  max: parseInt(process.env['RATE_LIMIT_LOGIN_MAX'] ?? '10', 10),
  windowSeconds: parseInt(process.env['RATE_LIMIT_LOGIN_WINDOW'] ?? '60', 10),
  keyPrefix: 'ratelimit:login',
});

const REFRESH_RATE_LIMIT = rateLimitMiddleware({
  max: parseInt(process.env['RATE_LIMIT_REFRESH_MAX'] ?? '30', 10),
  windowSeconds: parseInt(process.env['RATE_LIMIT_REFRESH_WINDOW'] ?? '60', 10),
  keyPrefix: 'ratelimit:refresh',
});

const PASSWORD_CHANGE_RATE_LIMIT = rateLimitMiddleware({
  max: parseInt(process.env['RATE_LIMIT_PASSWORD_MAX'] ?? '5', 10),
  windowSeconds: parseInt(process.env['RATE_LIMIT_PASSWORD_WINDOW'] ?? '300', 10),
  keyPrefix: 'ratelimit:password',
});

// OpenAPI JSON Schema 정의 (CSAP D-12: API 문서화)
const loginSchemaOpts = {
  schema: {
    description: '사용자 로그인 (JWT 토큰 발급, CSAP D-08-01)',
    tags: ['auth'],
    body: {
      type: 'object' as const,
      required: ['email', 'password', 'tenantSlug'],
      properties: {
        email: { type: 'string' as const, format: 'email' },
        password: { type: 'string' as const, minLength: 8 },
        tenantSlug: { type: 'string' as const },
        mfaCode: { type: 'string' as const, pattern: '^[0-9]{6}$' },
      },
    },
    response: {
      200: {
        type: 'object' as const,
        properties: {
          success: { type: 'boolean' as const },
          data: {
            type: 'object' as const,
            properties: {
              accessToken: { type: 'string' as const },
              refreshToken: { type: 'string' as const },
              expiresIn: { type: 'number' as const },
            },
          },
        },
      },
      401: {
        type: 'object' as const,
        properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const } },
      },
      429: {
        type: 'object' as const,
        properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const } },
      },
    },
  },
  preHandler: LOGIN_RATE_LIMIT,
};

const logoutSchemaOpts = {
  schema: {
    description: '로그아웃 (토큰 블랙리스트 등록)',
    tags: ['auth'],
    response: { 200: { type: 'object' as const, properties: { success: { type: 'boolean' as const } } } },
  },
};

const refreshSchemaOpts = {
  schema: {
    description: '토큰 갱신 (CSAP D-08-02)',
    tags: ['auth'],
    body: {
      type: 'object' as const,
      required: ['refreshToken'],
      properties: { refreshToken: { type: 'string' as const } },
    },
    response: {
      200: {
        type: 'object' as const,
        properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const } },
      },
    },
  },
  preHandler: REFRESH_RATE_LIMIT,
};

const verifySchemaOpts = {
  schema: {
    description: 'JWT 토큰 검증',
    tags: ['auth'],
    headers: {
      type: 'object' as const,
      properties: { authorization: { type: 'string' as const } },
    },
    response: {
      200: {
        type: 'object' as const,
        properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const } },
      },
    },
  },
};

const passwordChangeSchemaOpts = {
  schema: {
    description: '비밀번호 변경 (CSAP D-08-07 비밀번호 정책)',
    tags: ['auth'],
    body: {
      type: 'object' as const,
      required: ['currentPassword', 'newPassword'],
      properties: {
        currentPassword: { type: 'string' as const },
        newPassword: { type: 'string' as const, minLength: 8, maxLength: 128 },
      },
    },
    response: { 200: { type: 'object' as const, properties: { success: { type: 'boolean' as const } } } },
  },
  preHandler: PASSWORD_CHANGE_RATE_LIMIT,
};

const mfaSetupSchemaOpts = {
  schema: {
    description: 'MFA TOTP 등록 시작 (CSAP D-08-08)',
    tags: ['auth'],
    body: {
      type: 'object' as const,
      required: ['password'],
      properties: { password: { type: 'string' as const } },
    },
    response: {
      200: {
        type: 'object' as const,
        properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const } },
      },
    },
  },
};

const mfaVerifySchemaOpts = {
  schema: {
    description: 'MFA TOTP 등록 검증/활성화 (CSAP D-08-08)',
    tags: ['auth'],
    body: {
      type: 'object' as const,
      required: ['code'],
      properties: { code: { type: 'string' as const, pattern: '^[0-9]{6}$' } },
    },
    response: { 200: { type: 'object' as const, properties: { success: { type: 'boolean' as const } } } },
  },
};

const mfaDisableSchemaOpts = {
  schema: {
    description: 'MFA 비활성화',
    tags: ['auth'],
    body: {
      type: 'object' as const,
      required: ['password', 'code'],
      properties: {
        password: { type: 'string' as const },
        code: { type: 'string' as const, pattern: '^[0-9]{6}$' },
      },
    },
    response: { 200: { type: 'object' as const, properties: { success: { type: 'boolean' as const } } } },
  },
};

const sessionInvalidateSchemaOpts = {
  schema: {
    description: '사용자 전체 세션 무효화 (내부 서비스 전용, CSAP D-08-03)',
    tags: ['auth'],
    body: {
      type: 'object' as const,
      required: ['userId'],
      properties: { userId: { type: 'string' as const, format: 'uuid' } },
    },
    response: { 200: { type: 'object' as const, properties: { success: { type: 'boolean' as const } } } },
  },
  preHandler: requireServiceAuth,
};

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/login — 로그인
  // Plan SC: FR-AUTH.1 (MFA 검증 통합), FR-AUTH.3 (Rate Limiting)
  app.post('/auth/login', loginSchemaOpts, loginHandler);

  // POST /auth/logout — 로그아웃
  // Plan SC: FR-P01.4
  app.post('/auth/logout', logoutSchemaOpts, logoutHandler);

  // POST /auth/refresh — 토큰 갱신
  // Plan SC: FR-P01.3, FR-AUTH.3 (Rate Limiting)
  app.post('/auth/refresh', refreshSchemaOpts, refreshHandler);

  // GET /auth/verify — 토큰 검증
  // Plan SC: FR-P01.2
  app.get('/auth/verify', verifySchemaOpts, verifyHandler);

  // POST /auth/password/change — 비밀번호 변경
  // Plan SC: FR-AUTH.2, FR-AUTH.3 (Rate Limiting)
  // CSAP D-08-07: 비밀번호 정책
  app.post('/auth/password/change', passwordChangeSchemaOpts, passwordChangeHandler);

  // POST /auth/mfa/setup — MFA TOTP 등록 시작
  // Plan SC: FR-P01.10
  app.post('/auth/mfa/setup', mfaSetupSchemaOpts, mfaSetupHandler);

  // POST /auth/mfa/verify — MFA TOTP 등록 검증/활성화
  // Plan SC: FR-P01.10
  app.post('/auth/mfa/verify', mfaVerifySchemaOpts, mfaVerifyHandler);

  // DELETE /auth/mfa — MFA 비활성화
  // Plan SC: FR-P01.10
  app.delete('/auth/mfa', mfaDisableSchemaOpts, mfaDisableHandler);

  // POST /auth/sessions/invalidate — 사용자 전체 세션 무효화 (내부 서비스 전용)
  // Plan SC: FR-AUTH.4 (서비스 간 인증)
  // CSAP D-08-03: 보안 이벤트 시 즉시 세션 무효화
  app.post('/auth/sessions/invalidate', sessionInvalidateSchemaOpts, invalidateAllSessionsHandler);
}
