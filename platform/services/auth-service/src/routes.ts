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

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/login — 로그인
  // Plan SC: FR-AUTH.1 (MFA 검증 통합), FR-AUTH.3 (Rate Limiting)
  app.post('/auth/login', { preHandler: LOGIN_RATE_LIMIT }, loginHandler);

  // POST /auth/logout — 로그아웃
  // Plan SC: FR-P01.4
  app.post('/auth/logout', logoutHandler);

  // POST /auth/refresh — 토큰 갱신
  // Plan SC: FR-P01.3, FR-AUTH.3 (Rate Limiting)
  app.post('/auth/refresh', { preHandler: REFRESH_RATE_LIMIT }, refreshHandler);

  // GET /auth/verify — 토큰 검증
  // Plan SC: FR-P01.2
  app.get('/auth/verify', verifyHandler);

  // POST /auth/password/change — 비밀번호 변경
  // Plan SC: FR-AUTH.2, FR-AUTH.3 (Rate Limiting)
  // CSAP D-08-07: 비밀번호 정책
  app.post('/auth/password/change', { preHandler: PASSWORD_CHANGE_RATE_LIMIT }, passwordChangeHandler);

  // POST /auth/mfa/setup — MFA TOTP 등록 시작
  // Plan SC: FR-P01.10
  app.post('/auth/mfa/setup', mfaSetupHandler);

  // POST /auth/mfa/verify — MFA TOTP 등록 검증/활성화
  // Plan SC: FR-P01.10
  app.post('/auth/mfa/verify', mfaVerifyHandler);

  // DELETE /auth/mfa — MFA 비활성화
  // Plan SC: FR-P01.10
  app.delete('/auth/mfa', mfaDisableHandler);

  // POST /auth/sessions/invalidate — 사용자 전체 세션 무효화 (내부 서비스 전용)
  // Plan SC: FR-AUTH.4 (서비스 간 인증)
  // CSAP D-08-03: 보안 이벤트 시 즉시 세션 무효화
  app.post('/auth/sessions/invalidate', { preHandler: requireServiceAuth }, invalidateAllSessionsHandler);
}
